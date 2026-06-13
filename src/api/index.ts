// HTTP API over the scraped data and the hedonic valuation model.
// Thin JSON layer over src/db and src/analysis; serves the analyzer UI at /.
//
//   GET /api/health
//   GET /api/stats
//   GET /api/cities?type=rent|sale
//   GET /api/market?type=&city=
//   GET /api/listings?type=&city=&district=&minPrice=&maxPrice=&minSize=
//                     &maxSize=&rooms=&sort=&limit=&offset=
//   GET /api/listings/:id
//   GET /api/listings/:id/analyze
//   GET /api/listings/:id/area      (live network call to oikotie.fi)
//   GET /api/deals?type=&city=&district=&minScore=&limit=&includeFlagged=

import { config } from "../config";
import { getStats, searchDb, getListingById, getPriceHistory } from "../db";
import {
  valuateListing,
  findSmartDeals,
  findComparables,
  getCityModel,
  cityMarket,
  allCitySummaries,
  serializeValuation,
  serializeListingRow,
  serializeDetailRow,
} from "../analysis";
import { getAreaProfile } from "../scraper/client";
import { getOrFetchDetail } from "../scraper/details";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function parseType(v: string | null): "rent" | "sale" {
  return v === "sale" ? "sale" : "rent";
}

function num(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const SORTS: Record<string, string> = {
  price: "price ASC",
  "-price": "price DESC",
  size: "size_m2 ASC",
  "-size": "size_m2 DESC",
  newest: "published_at DESC",
  popular: "visits_weekly DESC",
};

function handleListings(url: URL): Response {
  const q = url.searchParams;
  const { listings, total } = searchDb({
    type: parseType(q.get("type")),
    city: q.get("city") ?? undefined,
    district: q.get("district") ?? undefined,
    minPrice: num(q.get("minPrice")),
    maxPrice: num(q.get("maxPrice")),
    minSize: num(q.get("minSize")),
    maxSize: num(q.get("maxSize")),
    rooms: num(q.get("rooms")),
    limit: Math.min(num(q.get("limit")) ?? 25, 100),
    offset: num(q.get("offset")) ?? 0,
    orderBy: SORTS[q.get("sort") ?? "price"] ?? "price ASC",
  });
  return json({
    total,
    count: listings.length,
    offset: num(q.get("offset")) ?? 0,
    listings: (listings as Record<string, unknown>[]).map(serializeListingRow),
  });
}

async function handleAnalyze(id: number): Promise<Response> {
  const v = valuateListing(id);
  if (!v) {
    return json(
      { error: `Cannot analyze ${id}: not found, missing price/size, or too little data for its city.` },
      404,
    );
  }
  const model = v.row.city ? getCityModel(v.row.type, v.row.city) : null;
  const comparables = model
    ? findComparables(model, v.row).map((r) => ({
        id: r.id,
        url: r.url,
        address: r.address,
        roomConfig: r.room_config,
        sizeM2: r.size_m2,
        price: r.price,
        pricePerM2: Math.round((r.price / r.size_m2) * 10) / 10,
      }))
    : [];
  return json({
    valuation: serializeValuation(v),
    detail: serializeDetailRow(await getOrFetchDetail(id)),
    comparables,
    priceHistory: getPriceHistory(id),
  });
}

async function route(req: Request, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/health") return json({ ok: true });
  if (path === "/api/stats") return json(getStats());

  if (path === "/api/cities") {
    return json(allCitySummaries(parseType(url.searchParams.get("type"))));
  }

  if (path === "/api/market") {
    const type = parseType(url.searchParams.get("type"));
    const city = url.searchParams.get("city");
    if (!city) return json(allCitySummaries(type));
    const mkt = cityMarket(type, city);
    return mkt ? json(mkt) : json({ error: `No data for ${city} (${type})` }, 404);
  }

  if (path === "/api/listings") return handleListings(url);

  const detailRoute = path.match(/^\/api\/listings\/(\d+)(\/analyze|\/area|\/detail)?$/);
  if (detailRoute) {
    const id = Number(detailRoute[1]);
    const sub = detailRoute[2];
    if (sub === "/analyze") return handleAnalyze(id);
    if (sub === "/area") {
      const profile = await getAreaProfile(id);
      return profile ? json(profile) : json({ error: `No area profile for ${id}` }, 404);
    }
    if (sub === "/detail") {
      const d = await getOrFetchDetail(id);
      return d ? json(serializeDetailRow(d)) : json({ error: `No detail for ${id}` }, 404);
    }
    const listing = getListingById(id) as Record<string, unknown> | null;
    if (!listing) return json({ error: `Listing ${id} not found` }, 404);
    return json({
      listing: serializeListingRow(listing),
      detail: serializeDetailRow(await getOrFetchDetail(id)),
      priceHistory: getPriceHistory(id),
    });
  }

  if (path === "/api/deals") {
    const q = url.searchParams;
    return json(
      findSmartDeals(parseType(q.get("type")), {
        city: q.get("city") ?? undefined,
        district: q.get("district") ?? undefined,
        minScore: num(q.get("minScore")) ?? 40,
        limit: Math.min(num(q.get("limit")) ?? 30, 100),
        includeFlagged: q.get("includeFlagged") === "true",
      }).map(serializeValuation),
    );
  }

  // Static UI
  if (path === "/" || path === "/index.html") {
    return new Response(Bun.file(new URL("./index.html", import.meta.url)), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return json({ error: "Not found" }, 404);
}

const server = Bun.serve({
  port: config.api.port,
  idleTimeout: 30,
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    try {
      return await route(req, url);
    } catch (err) {
      console.error(`${req.method} ${url.pathname} —`, err);
      return json({ error: (err as Error).message }, 500);
    }
  },
});

console.log(`oikotie API on http://localhost:${server.port}`);
