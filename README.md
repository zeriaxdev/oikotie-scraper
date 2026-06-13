# oikotie-scraper

Scraper, price-analysis engine, interactive CLI and MCP server for [Oikotie](https://asunnot.oikotie.fi) apartment listings (rent and sale).

Crawls Oikotie's JSON API city by city, stores everything in SQLite with price history, fits a hedonic pricing model per city, and surfaces listings priced below what their attributes predict. The MCP server exposes the whole thing to an AI agent.

## Requirements

- [Bun](https://bun.sh) ≥ 1.1 — runtime, SQLite driver and test runner. No Node, no API keys: the OTA tokens the API needs are public `<meta>` tags on any Oikotie page and are bootstrapped automatically.

## Setup

```sh
bun install
```

## Scraping

```sh
bun run scrape                          # interactive city picker, rentals
bun run scrape -- --cities=Helsinki,Espoo --type=rent,sale
bun run scrape:all                      # all 19 cities, rent + sale
bun run scrape:stats                    # database summary
```

The search crawl stores the summary card for each listing. The **full "Perustiedot" detail** (kitchen/bathroom appliances, availability dates, rent terms, deposit info, water fee, sauna, lift, balcony, condition, energy class, smoking/pet terms, plus the complete raw payload) comes from a separate per-listing endpoint and is fetched lazily on first access — or backfilled in bulk:

```sh
bun run scrape:details                       # 500 most-viewed listings missing details
bun run scrape:details --city=Helsinki
bun run scrape:details --type=rent --limit=2000
```

It's stored in `listing_details` (one row per listing, `raw_json` keeps everything) and surfaces automatically in `GET /api/listings/:id`, the web drawer, and the MCP `get_listing` tool.

Requests are token-bucket rate-limited with delays between pages, User-Agents are rotated, raw API responses are stored alongside parsed rows, and upserts are idempotent — re-scraping updates listings and appends to `price_history` only when a price actually changed.

## CLI

```sh
bun run cli            # interactive REPL
bun run cli <command>  # one-shot
```

| Command | What it does |
|---|---|
| `stats` | Database overview |
| `search --city=Helsinki --max-price=900 --rooms=2` | Filtered search with pagination (`next`/`prev`) |
| `listing <id>` | Full detail + live area profile and similar listings |
| `analyze <id>` | Valuation: model estimate, edge vs market, verdict, comparables |
| `market [rent\|sale] [city]` | Market overview; with a city: size bands + district premiums |
| `deals [rent\|sale] [--city=X] [--min-score=40]` | Below-market listings ranked by deal score |
| `regions [rent\|sale]` | Descriptive price stats per district |
| `open <id>` | Open the listing in the browser |

## How the analysis works

Naive €/m² comparisons mislead: small apartments always cost more per square meter, and district averages mix studios with family flats. Instead, for every city with enough data the engine fits a **hedonic regression**:

```
log(price) ~ log(size) + rooms + age + age² + floor position + district fixed effects
```

- **Two-pass fit** — fit once, drop outliers beyond 2.5 robust standard deviations (shared flats, typos, luxury one-offs), refit on the inliers.
- **Duan smearing** — predictions in log space are bias-corrected back to euros.
- **Robust z-scores** — a listing's deal signal is its log-residual divided by the MAD-based sigma of all residuals, so a `z` of −5 means "five robust standard deviations cheaper than comparable apartments". Helsinki rentals fit with R² ≈ 0.91.
- **Deal score (0–100)** — combines edge size, statistical significance, model/district confidence, and demand (weekly views percentile). Listings more than 45 % under model are flagged `suspicious` instead of celebrated — they're usually shared flats or data errors.
- **District premiums** — the fixed-effect coefficients isolate what location alone costs, controlling for everything else (e.g. Kamppi ≈ +60 % over the Helsinki baseline).

`analyze <id>` shows the estimate with an error band, the verdict, percentiles, and the closest same-district comparables so you can sanity-check the model with your own eyes.

## Web app & HTTP API

```sh
bun run api          # http://localhost:3000
bun run dev          # same, with hot reload
PORT=8080 bun run api
```

Open the root URL for the **analyzer UI** — a single-page app to browse the market, search with filters, and inspect any listing's valuation (model estimate vs asking, edge gauge, comparables, price history) in a side drawer.

The same server exposes a JSON API (CORS-enabled, so a separate frontend can call it too):

| Endpoint | Returns |
|---|---|
| `GET /api/stats` | Counts, cities, last scrape run |
| `GET /api/cities?type=` | Per-city summaries (median, €/m², model R²) |
| `GET /api/market?type=&city=` | City detail: size bands + district premiums |
| `GET /api/listings?type=&city=&district=&minPrice=&maxPrice=&minSize=&maxSize=&rooms=&sort=&limit=&offset=` | Filtered, paginated listings |
| `GET /api/listings/:id` | Core fields + Perustiedot detail + price history |
| `GET /api/listings/:id/detail` | Just the Perustiedot detail (lazy-fetched) |
| `GET /api/listings/:id/analyze` | Valuation + comparables + price history |
| `GET /api/listings/:id/area` | Live area profile (transit, services, demographics) |
| `GET /api/deals?type=&city=&minScore=&limit=&includeSuspicious=` | Model-scored below-market listings |

`sort` accepts `price`, `-price`, `size`, `-size`, `newest`, `popular`.

## Building another app on top (Next.js, etc.)

Two ways to reuse this data, depending on how coupled you want to be:

**1. Consume the HTTP API (recommended, framework-agnostic).** Run `bun run api` and call it from any frontend. From a Next.js server component or route handler:

```ts
const deals = await fetch("http://localhost:3000/api/deals?city=Helsinki", {
  next: { revalidate: 300 },
}).then((r) => r.json());
```

This keeps the scraper/model in one place and your UI in another. CORS is open, so a browser client can call it directly too.

**2. Import the data layer directly (same database, no HTTP).** The `src/db` and `src/analysis` modules are plain functions over the SQLite file — point `DB_PATH` at `oikotie.db` and call them. Because they use `bun:sqlite`, the consuming app must run on **Bun** (e.g. `next dev` under Bun, or a Bun-based API). Example:

```ts
import { searchDb } from "oikotie/src/db";
import { findSmartDeals, cityMarket } from "oikotie/src/analysis";

const { listings } = searchDb({ type: "rent", city: "Helsinki", maxPrice: 900 });
const deals = findSmartDeals("rent", { city: "Helsinki", minScore: 50 });
```

For a Node-only Next.js app, use option 1 — `bun:sqlite` isn't available under Node, and this project intentionally avoids `better-sqlite3`.

## MCP server

Exposes the database and the valuation model to AI agents over stdio.

Tools: `db_stats`, `search_listings`, `get_listing`, `analyze_listing`, `find_deals`, `market_overview`, `get_area_profile` (live).

### Claude Code

```sh
claude mcp add oikotie \
  --env DB_PATH=/absolute/path/to/oikotie-scraper/oikotie.db \
  -- bun /absolute/path/to/oikotie-scraper/src/mcp/index.ts
```

Verify with `/mcp`, then ask things like *"find rental deals in Helsinki under 1000 € and analyze the best one"*.

### Claude Desktop

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "oikotie": {
      "command": "bun",
      "args": ["/absolute/path/to/oikotie-scraper/src/mcp/index.ts"],
      "env": { "DB_PATH": "/absolute/path/to/oikotie-scraper/oikotie.db" }
    }
  }
}
```

## Database

SQLite (`oikotie.db`, WAL mode), four tables:

- `listings` — one row per listing, upserted; `created_at`/`updated_at` timestamps
- `price_history` — appended whenever a scrape sees a new price for a listing
- `scrape_runs` — run log with counts and errors
- `raw_responses` — raw API JSON per page, so data can be re-extracted later

Set `DB_PATH` to use a different database file.

## Project layout

```
src/
  scraper/   API client, token bootstrap, rate limiter, city crawler
  db/        schema, upserts, query helpers
  analysis/  statistics, hedonic model, market overview
  cli/       REPL + commands + table rendering
  mcp/       MCP server (stdio)
```

## Note

This scrapes a public website's API. Be considerate: keep the rate limits, don't hammer, and treat the data as Oikotie's. For personal analysis only.
