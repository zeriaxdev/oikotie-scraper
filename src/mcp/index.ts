// MCP server exposing the scraped Oikotie data and the hedonic valuation
// model over stdio. Connect from Claude Code / Claude Desktop; see README.
//
// stdout carries the JSON-RPC protocol — never console.log here.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getStats, searchDb, getListingById, getPriceHistory } from "../db";
import {
  valuateListing,
  findSmartDeals,
  findComparables,
  getCityModel,
  cityMarket,
  allCitySummaries,
  serializeValuation,
  serializeDetailRow,
} from "../analysis";
import { getAreaProfile } from "../scraper/client";
import { getOrFetchDetail } from "../scraper/details";

const server = new McpServer({ name: "oikotie", version: "0.1.0" });

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const typeSchema = z.enum(["rent", "sale"]).default("rent").describe("Listing type");

server.registerTool(
  "db_stats",
  {
    title: "Database stats",
    description:
      "Overview of the scraped Oikotie database: total listings, rent/sale split, listings per city, and the last scrape run.",
    inputSchema: {},
  },
  async () => json(getStats()),
);

server.registerTool(
  "search_listings",
  {
    title: "Search listings",
    description:
      "Search scraped apartment listings with filters. Returns matching listings (without full descriptions) and the total count. Prices are EUR; for rentals the price is monthly rent.",
    inputSchema: {
      type: typeSchema,
      city: z.string().optional().describe("City, e.g. Helsinki"),
      district: z.string().optional().describe("District, e.g. Kallio"),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
      minSize: z.number().optional().describe("Min size in m²"),
      maxSize: z.number().optional().describe("Max size in m²"),
      rooms: z.number().int().optional().describe("Exact room count"),
      sort: z
        .enum(["price ASC", "price DESC", "size_m2 ASC", "size_m2 DESC", "published_at DESC", "visits_weekly DESC"])
        .default("price ASC"),
      limit: z.number().int().min(1).max(100).default(25),
      offset: z.number().int().min(0).default(0),
    },
  },
  async (args) => {
    const { listings, total } = searchDb({ ...args, orderBy: args.sort });
    const slim = (listings as Record<string, unknown>[]).map((l) => ({
      id: l.id,
      url: l.url,
      address: l.address,
      district: l.district,
      city: l.city,
      price: l.price,
      sizeM2: l.size_m2,
      rooms: l.rooms,
      roomConfig: l.room_config,
      floor: l.floor,
      buildYear: l.build_year,
      visitsWeekly: l.visits_weekly,
      publishedAt: l.published_at,
    }));
    return json({ total, count: slim.length, offset: args.offset, listings: slim });
  },
);

server.registerTool(
  "get_listing",
  {
    title: "Get listing",
    description:
      "Full detail for one listing by id: core fields, the lazily-fetched 'Perustiedot' detail (appliances, fees, availability, sauna, lift, terms, etc.), and price history.",
    inputSchema: { id: z.number().int().describe("Oikotie listing/card id") },
  },
  async ({ id }) => {
    const listing = getListingById(id);
    if (!listing) return json({ error: `Listing ${id} not found` });
    return json({
      listing,
      detail: serializeDetailRow(await getOrFetchDetail(id)),
      priceHistory: getPriceHistory(id),
    });
  },
);

server.registerTool(
  "analyze_listing",
  {
    title: "Analyze listing (valuation)",
    description:
      "Hedonic-model valuation of a listing: expected price for its attributes (size, rooms, age, floor, district), edge vs market, robust z-score, verdict, deal score 0-100, demand percentile, and closest comparables. Negative edge = cheaper than the model expects.",
    inputSchema: { id: z.number().int().describe("Oikotie listing/card id") },
  },
  async ({ id }) => {
    const v = valuateListing(id);
    if (!v) {
      return json({
        error: `Cannot analyze ${id}: listing not found, missing price/size, or too little data for its city.`,
      });
    }
    const model = v.row.city ? getCityModel(v.row.type, v.row.city) : null;
    const comparables = model
      ? findComparables(model, v.row).map((r) => ({
          id: r.id,
          address: r.address,
          roomConfig: r.room_config,
          sizeM2: r.size_m2,
          price: r.price,
          ppm2: Math.round((r.price / r.size_m2) * 10) / 10,
        }))
      : [];
    return json({ valuation: serializeValuation(v), comparables, priceHistory: getPriceHistory(id) });
  },
);

server.registerTool(
  "find_deals",
  {
    title: "Find deals",
    description:
      "Below-market listings ranked by deal score (0-100). A deal is priced at least one robust standard deviation under its hedonic-model estimate. Listings whose description reveals a renovation, sublet, shared/room rental, or short-term lease — or that are >45% under model (likely a room or data error) — are flagged and excluded unless includeFlagged is set.",
    inputSchema: {
      type: typeSchema,
      city: z.string().optional().describe("Restrict to one city"),
      district: z.string().optional().describe("Restrict to one district"),
      minScore: z.number().int().min(0).max(100).default(40),
      limit: z.number().int().min(1).max(100).default(20),
      includeFlagged: z.boolean().default(false).describe("Include renovation/sublet/shared/suspicious listings"),
    },
  },
  async ({ type, city, district, minScore, limit, includeFlagged }) =>
    json(findSmartDeals(type, { city, district, minScore, limit, includeFlagged }).map(serializeValuation)),
);

server.registerTool(
  "market_overview",
  {
    title: "Market overview",
    description:
      "Without a city: per-city listing counts, median prices, median EUR/m² and model fit. With a city: price distribution, EUR/m² by size band, and a district table with model-derived location premiums (controls for size, rooms, age, floor).",
    inputSchema: {
      type: typeSchema,
      city: z.string().optional().describe("City to drill into, e.g. Helsinki"),
    },
  },
  async ({ type, city }) => {
    if (!city) return json(allCitySummaries(type));
    const mkt = cityMarket(type, city);
    return json(mkt ?? { error: `No data for ${city} (${type})` });
  },
);

server.registerTool(
  "get_area_profile",
  {
    title: "Get area profile (live)",
    description:
      "Fetch the live Oikotie area profile for a listing: nearby transit, services, schools, healthcare and demographics. Makes a rate-limited network request to oikotie.fi.",
    inputSchema: { id: z.number().int().describe("Oikotie listing/card id") },
  },
  async ({ id }) => {
    const profile = await getAreaProfile(id);
    return json(profile ?? { error: `No area profile available for ${id}` });
  },
);

await server.connect(new StdioServerTransport());
console.error("oikotie MCP server running on stdio");
