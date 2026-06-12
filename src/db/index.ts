import { Database } from "bun:sqlite";
import { config } from "../config";
import type { Listing, PriceSnapshot } from "../scraper/types";

let _db: Database | null = null;

export function getDb(): Database {
  if (!_db) {
    _db = new Database(config.db.path, { create: true });
    _db.exec("PRAGMA journal_mode = WAL");
    _db.exec("PRAGMA foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('rent', 'sale')),
      price REAL,
      price_str TEXT,
      rooms INTEGER,
      room_config TEXT,
      size_m2 REAL,
      build_year INTEGER,
      floor INTEGER,
      total_floors INTEGER,
      address TEXT,
      district TEXT,
      city TEXT,
      zip_code TEXT,
      lat REAL,
      lng REAL,
      description TEXT,
      security_deposit REAL,
      maintenance_fee REAL,
      condition TEXT,
      visits INTEGER DEFAULT 0,
      visits_weekly INTEGER DEFAULT 0,
      company_name TEXT,
      published_at TEXT,
      price_changed_at TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      price REAL NOT NULL,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scrape_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      filters_json TEXT,
      total_found INTEGER NOT NULL DEFAULT 0,
      total_upserted INTEGER NOT NULL DEFAULT 0,
      total_errors INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS raw_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scrape_run_id INTEGER REFERENCES scrape_runs(id),
      url TEXT NOT NULL,
      response_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
    CREATE INDEX IF NOT EXISTS idx_listings_district ON listings(city, district);
    CREATE INDEX IF NOT EXISTS idx_listings_type ON listings(type);
    CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(type, price);
    CREATE INDEX IF NOT EXISTS idx_listings_rooms ON listings(rooms);
    CREATE INDEX IF NOT EXISTS idx_listings_zip ON listings(zip_code);
    CREATE INDEX IF NOT EXISTS idx_price_history_listing ON price_history(listing_id, scraped_at);
    CREATE INDEX IF NOT EXISTS idx_raw_responses_run ON raw_responses(scrape_run_id);
  `);
}

const upsertListingSql = `
  INSERT INTO listings (
    id, url, type, price, price_str, rooms, room_config, size_m2,
    build_year, floor, total_floors, address, district, city, zip_code,
    lat, lng, description, security_deposit, maintenance_fee, condition,
    visits, visits_weekly, company_name, published_at, price_changed_at, image_url
  ) VALUES (
    $id, $url, $type, $price, $priceStr, $rooms, $roomConfig, $sizeM2,
    $buildYear, $floor, $totalFloors, $address, $district, $city, $zipCode,
    $lat, $lng, $description, $securityDeposit, $maintenanceFee, $condition,
    $visits, $visitsWeekly, $companyName, $publishedAt, $priceChangedAt, $imageUrl
  ) ON CONFLICT(id) DO UPDATE SET
    price = excluded.price,
    price_str = excluded.price_str,
    visits = excluded.visits,
    visits_weekly = excluded.visits_weekly,
    price_changed_at = excluded.price_changed_at,
    description = excluded.description,
    image_url = excluded.image_url,
    updated_at = datetime('now')
`;

export function upsertListing(listing: Listing): boolean {
  const db = getDb();
  const stmt = db.prepare(upsertListingSql);

  const existingPrice = db
    .prepare<{ price: number | null }, [number]>("SELECT price FROM listings WHERE id = ?")
    .get(listing.id);

  stmt.run({
    $id: listing.id,
    $url: listing.url,
    $type: listing.type,
    $price: listing.price,
    $priceStr: listing.priceStr,
    $rooms: listing.rooms,
    $roomConfig: listing.roomConfig,
    $sizeM2: listing.sizeM2,
    $buildYear: listing.buildYear,
    $floor: listing.floor,
    $totalFloors: listing.totalFloors,
    $address: listing.address,
    $district: listing.district,
    $city: listing.city,
    $zipCode: listing.zipCode,
    $lat: listing.lat,
    $lng: listing.lng,
    $description: listing.description,
    $securityDeposit: listing.securityDeposit,
    $maintenanceFee: listing.maintenanceFee,
    $condition: listing.condition,
    $visits: listing.visits,
    $visitsWeekly: listing.visitsWeekly,
    $companyName: listing.companyName,
    $publishedAt: listing.publishedAt,
    $priceChangedAt: listing.priceChangedAt,
    $imageUrl: listing.imageUrl,
  });

  if (listing.price != null && existingPrice?.price !== listing.price) {
    db.prepare("INSERT INTO price_history (listing_id, price) VALUES (?, ?)").run(
      listing.id,
      listing.price,
    );
  }

  return existingPrice === null;
}

export function upsertListingsBatch(listings: Listing[]): { inserted: number; errors: number } {
  const db = getDb();
  let inserted = 0;
  let errors = 0;

  const tx = db.transaction(() => {
    for (const listing of listings) {
      try {
        if (upsertListing(listing)) inserted++;
      } catch {
        errors++;
      }
    }
  });
  tx();

  return { inserted, errors };
}

export function startScrapeRun(type: string, filters?: object): number {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO scrape_runs (type, filters_json) VALUES (?, ?) RETURNING id")
    .get(type, filters ? JSON.stringify(filters) : null) as { id: number };
  return result.id;
}

export function finishScrapeRun(runId: number, totalFound: number, upserted: number, errors: number) {
  getDb()
    .prepare(
      "UPDATE scrape_runs SET total_found = ?, total_upserted = ?, total_errors = ?, finished_at = datetime('now') WHERE id = ?",
    )
    .run(totalFound, upserted, errors, runId);
}

export function saveRawResponse(runId: number, url: string, json: string) {
  getDb()
    .prepare("INSERT INTO raw_responses (scrape_run_id, url, response_json) VALUES (?, ?, ?)")
    .run(runId, url, json);
}

// --- Query helpers for analysis ---

export type RegionStats = {
  city: string;
  district: string;
  count: number;
  avgPrice: number;
  medianPrice: number;
  minPrice: number;
  maxPrice: number;
  avgPricePerM2: number;
  avgSize: number;
};

export function getRegionStats(type: "rent" | "sale" = "rent"): RegionStats[] {
  return getDb()
    .prepare<RegionStats, [string]>(
      `
      SELECT
        city,
        district,
        COUNT(*) as count,
        ROUND(AVG(price), 2) as avgPrice,
        ROUND(MIN(price), 2) as minPrice,
        ROUND(MAX(price), 2) as maxPrice,
        ROUND(AVG(CASE WHEN size_m2 > 0 THEN price / size_m2 END), 2) as avgPricePerM2,
        ROUND(AVG(size_m2), 1) as avgSize
      FROM listings
      WHERE type = ? AND price IS NOT NULL
      GROUP BY city, district
      ORDER BY city, district
    `,
    )
    .all(type) as RegionStats[];
}

export function getMedianPriceByDistrict(
  type: "rent" | "sale" = "rent",
): { city: string; district: string; medianPrice: number }[] {
  const rows = getDb()
    .prepare<
      { city: string; district: string; price: number },
      [string]
    >(
      `SELECT city, district, price FROM listings
       WHERE type = ? AND price IS NOT NULL
       ORDER BY city, district, price`,
    )
    .all(type);

  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const key = `${row.city}|${row.district}`;
    const arr = groups.get(key) ?? [];
    arr.push(row.price);
    groups.set(key, arr);
  }

  const results: { city: string; district: string; medianPrice: number }[] = [];
  for (const [key, prices] of groups) {
    const [city, district] = key.split("|") as [string, string];
    const mid = Math.floor(prices.length / 2);
    const median =
      prices.length % 2 === 0
        ? (prices[mid - 1]! + prices[mid]!) / 2
        : prices[mid]!;
    results.push({ city, district, medianPrice: Math.round(median * 100) / 100 });
  }

  return results;
}

export function getListingById(id: number) {
  return getDb()
    .prepare<Listing & { created_at: string; updated_at: string }, [number]>(
      "SELECT * FROM listings WHERE id = ?",
    )
    .get(id);
}

export function getPriceHistory(listingId: number): PriceSnapshot[] {
  return getDb()
    .prepare<{ listing_id: number; price: number; scraped_at: string }, [number]>(
      "SELECT listing_id, price, scraped_at FROM price_history WHERE listing_id = ? ORDER BY scraped_at",
    )
    .all(listingId)
    .map((r) => ({ listingId: r.listing_id, price: r.price, scrapedAt: r.scraped_at }));
}

export function searchDb(opts: {
  type?: "rent" | "sale";
  city?: string;
  district?: string;
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  rooms?: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
}) {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.type) {
    conditions.push("type = $type");
    params.$type = opts.type;
  }
  if (opts.city) {
    conditions.push("city = $city");
    params.$city = opts.city;
  }
  if (opts.district) {
    conditions.push("district = $district");
    params.$district = opts.district;
  }
  if (opts.minPrice != null) {
    conditions.push("price >= $minPrice");
    params.$minPrice = opts.minPrice;
  }
  if (opts.maxPrice != null) {
    conditions.push("price <= $maxPrice");
    params.$maxPrice = opts.maxPrice;
  }
  if (opts.minSize != null) {
    conditions.push("size_m2 >= $minSize");
    params.$minSize = opts.minSize;
  }
  if (opts.maxSize != null) {
    conditions.push("size_m2 <= $maxSize");
    params.$maxSize = opts.maxSize;
  }
  if (opts.rooms != null) {
    conditions.push("rooms = $rooms");
    params.$rooms = opts.rooms;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = opts.orderBy ?? "price ASC";
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;

  const rows = getDb()
    .prepare(`SELECT * FROM listings ${where} ORDER BY ${orderBy} LIMIT ${limit} OFFSET ${offset}`)
    .all(params as Record<string, string | number | null>);

  const countRow = getDb()
    .prepare(`SELECT COUNT(*) as total FROM listings ${where}`)
    .get(params as Record<string, string | number | null>) as { total: number };

  return { listings: rows, total: countRow.total };
}

export function getStats() {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as n FROM listings").get() as { n: number }).n;
  const rent = (
    db.prepare("SELECT COUNT(*) as n FROM listings WHERE type = 'rent'").get() as { n: number }
  ).n;
  const sale = (
    db.prepare("SELECT COUNT(*) as n FROM listings WHERE type = 'sale'").get() as { n: number }
  ).n;
  const cities = db
    .prepare("SELECT city, COUNT(*) as count FROM listings GROUP BY city ORDER BY count DESC")
    .all() as { city: string; count: number }[];
  const lastRun = db
    .prepare("SELECT * FROM scrape_runs ORDER BY id DESC LIMIT 1")
    .get();

  return { total, rent, sale, cities, lastRun };
}
