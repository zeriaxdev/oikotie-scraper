import {
  getStats,
  getRegionStats,
  findDeals,
  searchDb,
  getListingById,
  getPriceHistory,
  getMedianPriceByDistrict,
} from "../db";
import { getAreaProfile, getRecommendations, cardToListing, type AreaProfile } from "../scraper/client";
import {
  table,
  heading,
  kv,
  money,
  pct,
  m2,
  bold,
  dim,
  green,
  red,
  yellow,
  cyan,
  blue,
  magenta,
  gray,
  truncate,
  badge,
  c,
  type Column,
} from "./format";

export function stats() {
  const s = getStats();
  console.log(heading("Database Overview"));
  console.log(kv("Total listings", String(s.total)));
  console.log(kv("Rent", String(s.rent)));
  console.log(kv("Sale", String(s.sale)));

  if (s.cities.length > 0) {
    console.log(heading("By City"));
    const cols: Column[] = [
      { key: "city", label: "City", width: 18 },
      { key: "count", label: "Count", width: 8, align: "right" },
    ];
    console.log(table(s.cities as Record<string, unknown>[], cols));
  }

  if (s.lastRun) {
    const run = s.lastRun as Record<string, unknown>;
    console.log(heading("Last Scrape Run"));
    console.log(kv("Type", String(run.type)));
    console.log(kv("Found", String(run.total_found)));
    console.log(kv("Upserted", String(run.total_upserted)));
    console.log(kv("Errors", String(run.total_errors)));
    console.log(kv("Started", String(run.started_at)));
    console.log(kv("Finished", String(run.finished_at)));
  }
}

export function regions(type: "rent" | "sale" = "rent") {
  const data = getRegionStats(type);
  const medians = getMedianPriceByDistrict(type);
  const medianMap = new Map(
    medians.map((m) => [`${m.city}|${m.district}`, m.medianPrice]),
  );

  const rows = data.map((r) => ({
    ...r,
    medianPrice: medianMap.get(`${r.city}|${r.district}`) ?? null,
  }));

  console.log(heading(`Regional Price Stats (${type})`));

  const cols: Column[] = [
    { key: "city", label: "City", width: 14 },
    { key: "district", label: "District", width: 18 },
    { key: "count", label: "#", width: 5, align: "right" },
    {
      key: "avgPrice",
      label: "Avg €",
      width: 10,
      align: "right",
      format: (v) => money(v as number),
    },
    {
      key: "medianPrice",
      label: "Med €",
      width: 10,
      align: "right",
      format: (v) => money(v as number),
    },
    {
      key: "minPrice",
      label: "Min €",
      width: 10,
      align: "right",
      format: (v) => money(v as number),
    },
    {
      key: "maxPrice",
      label: "Max €",
      width: 10,
      align: "right",
      format: (v) => money(v as number),
    },
    {
      key: "avgPricePerM2",
      label: "€/m²",
      width: 8,
      align: "right",
      format: (v) => (v != null ? `${(v as number).toFixed(1)}` : dim("—")),
    },
  ];

  console.log(table(rows as Record<string, unknown>[], cols));
  console.log(dim(`  ${rows.length} districts`));
}

export function deals(type: "rent" | "sale" = "rent", threshold = 25) {
  const data = findDeals(type, threshold);

  console.log(heading(`Best Deals (${type}) — below ${threshold}th percentile`));

  const cols: Column[] = [
    { key: "id", label: "ID", width: 10 },
    { key: "city", label: "City", width: 12 },
    { key: "district", label: "District", width: 16 },
    {
      key: "price",
      label: "Price",
      width: 10,
      align: "right",
      format: (v) => money(v as number),
    },
    {
      key: "sizeM2",
      label: "Size",
      width: 8,
      align: "right",
      format: (v) => m2(v as number),
    },
    {
      key: "pricePerM2",
      label: "€/m²",
      width: 8,
      align: "right",
      format: (v) => `${(v as number).toFixed(1)}`,
    },
    {
      key: "districtAvgPricePerM2",
      label: "Avg €/m²",
      width: 9,
      align: "right",
      format: (v) => `${(v as number).toFixed(1)}`,
    },
    {
      key: "savingsPercent",
      label: "Saving",
      width: 8,
      align: "right",
      format: (v) => green(`-${(v as number).toFixed(1)}%`),
    },
  ];

  console.log(table(data as unknown as Record<string, unknown>[], cols));
  console.log(dim(`  ${data.length} deals found`));
}

export function search(opts: {
  city?: string;
  district?: string;
  type?: "rent" | "sale";
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  rooms?: number;
  limit?: number;
  offset?: number;
  sort?: string;
}) {
  const result = searchDb({
    type: opts.type ?? "rent",
    city: opts.city,
    district: opts.district,
    minPrice: opts.minPrice,
    maxPrice: opts.maxPrice,
    minSize: opts.minSize,
    maxSize: opts.maxSize,
    rooms: opts.rooms,
    limit: opts.limit ?? 20,
    offset: opts.offset ?? 0,
    orderBy: opts.sort ?? "price ASC",
  });

  const rows = result.listings as Record<string, unknown>[];

  console.log(heading(`Search Results — ${result.total} total`));

  const cols: Column[] = [
    { key: "id", label: "ID", width: 10 },
    { key: "city", label: "City", width: 12 },
    { key: "district", label: "District", width: 14 },
    {
      key: "price",
      label: "Price",
      width: 10,
      align: "right",
      format: (v) => money(v as number),
    },
    {
      key: "size_m2",
      label: "Size",
      width: 8,
      align: "right",
      format: (v) => m2(v as number),
    },
    { key: "rooms", label: "Rooms", width: 5, align: "right" },
    {
      key: "room_config",
      label: "Config",
      width: 14,
    },
    {
      key: "address",
      label: "Address",
      width: 24,
      format: (v) => truncate(v as string, 24),
    },
    {
      key: "floor",
      label: "Floor",
      width: 7,
      align: "right",
      format: (v, row) =>
        v != null
          ? `${v}/${row.total_floors ?? "?"}`
          : dim("—"),
    },
    {
      key: "description",
      label: "Description",
      width: 30,
      format: (v) => dim(truncate(v as string, 30)),
    },
  ];

  console.log(table(rows, cols));

  const showing = Math.min(opts.limit ?? 20, rows.length);
  const offset = opts.offset ?? 0;
  console.log(
    dim(`  Showing ${offset + 1}–${offset + showing} of ${result.total}`) +
      (result.total > offset + showing ? dim(`  — use ${cyan("next")} or ${cyan("search --offset=...")}`) : ""),
  );
}

export async function listing(id: number) {
  const row = getListingById(id) as Record<string, unknown> | null;
  if (!row) {
    console.log(red(`  Listing ${id} not found.`));
    return;
  }

  const typeBadge =
    row.type === "rent"
      ? badge("RENT", c.bgBlue)
      : badge("SALE", c.bgGreen);

  console.log(heading(`Listing ${id}`));
  console.log(`  ${typeBadge}  ${bold(String(row.address ?? "Unknown address"))}`);
  console.log(`  ${dim(String(row.district ?? ""))} · ${dim(String(row.city ?? ""))} · ${dim(String(row.zip_code ?? ""))}`);
  console.log();
  console.log(kv("Price", money(row.price as number)));
  console.log(kv("Size", m2(row.size_m2 as number)));
  if ((row.price as number) && (row.size_m2 as number)) {
    console.log(kv("€/m²", `${((row.price as number) / (row.size_m2 as number)).toFixed(1)}`));
  }
  console.log(kv("Rooms", String(row.room_config ?? row.rooms ?? "—")));
  console.log(kv("Floor", row.floor != null ? `${row.floor}/${row.total_floors ?? "?"}` : null));
  console.log(kv("Build year", row.build_year != null ? String(row.build_year) : null));
  console.log(kv("Condition", row.condition as string));
  console.log(kv("Security deposit", money(row.security_deposit as number)));
  console.log(kv("Maintenance fee", money(row.maintenance_fee as number)));
  console.log(kv("Company", String(row.company_name ?? "—")));
  console.log(kv("Visits", `${row.visits} total / ${row.visits_weekly} this week`));
  console.log(kv("Published", String(row.published_at ?? "—")));
  console.log(kv("Price changed", String(row.price_changed_at ?? "—")));
  console.log(kv("URL", cyan(String(row.url))));

  if (row.description) {
    console.log(heading("Description"));
    console.log(`  ${String(row.description)}`);
  }

  const history = getPriceHistory(id);
  if (history.length > 1) {
    console.log(heading("Price History"));
    for (const h of history) {
      console.log(`  ${dim(h.scrapedAt)}  ${money(h.price)}`);
    }
  }

  if (row.lat && row.lng) {
    console.log(kv("Coordinates", `${row.lat}, ${row.lng}`));
  }

  console.log(dim("\n  Fetching area profile..."));
  const area = await getAreaProfile(id);
  if (area) {
    printAreaProfile(area);
  }

  console.log(dim("  Fetching similar listings..."));
  const recs = await getRecommendations(id);
  if (recs.length > 0) {
    console.log(heading("Similar Listings"));
    const recCols: Column[] = [
      { key: "id", label: "ID", width: 10 },
      { key: "city", label: "City", width: 12 },
      { key: "district", label: "District", width: 14 },
      {
        key: "price",
        label: "Price",
        width: 10,
        align: "right",
        format: (v) => money(v as number),
      },
      {
        key: "sizeM2",
        label: "Size",
        width: 8,
        align: "right",
        format: (v) => m2(v as number),
      },
      { key: "rooms", label: "Rooms", width: 5, align: "right" },
      {
        key: "description",
        label: "Description",
        width: 30,
        format: (v) => dim(truncate(v as string, 30)),
      },
    ];
    const recRows = recs.slice(0, 8).map((card) => {
      const l = cardToListing(card);
      return l as unknown as Record<string, unknown>;
    });
    console.log(table(recRows, recCols));
  }
}

function printAreaProfile(area: AreaProfile) {
  const sections = [
    { key: "transportation" as const, icon: "Transit" },
    { key: "services" as const, icon: "Services" },
    { key: "family" as const, icon: "Family" },
    { key: "healthcare" as const, icon: "Health" },
    { key: "activities" as const, icon: "Activities" },
  ];

  const hasContent = sections.some((s) => area[s.key]?.content?.length);
  if (!hasContent && !area.demography) return;

  console.log(heading("Area Profile"));

  for (const { key, icon } of sections) {
    const section = area[key];
    if (!section?.content?.length) continue;

    console.log(`  ${bold(icon)}`);
    for (const item of section.content.slice(0, 3)) {
      console.log(
        `    ${dim(item.travelTime.padEnd(16))} ${item.name}${item.description ? dim(` — ${item.description}`) : ""}`,
      );
    }
  }

  if (area.demography) {
    const d = area.demography;
    const parts: string[] = [];
    if (d.children) parts.push(`Children: ${d.children.percentage}%`);
    if (d.adults) parts.push(`Adults: ${d.adults.percentage}%`);
    if (d.seniors) parts.push(`Seniors: ${d.seniors.percentage}%`);
    if (d.families) parts.push(`Families: ${d.families.percentage}%`);
    if (parts.length) {
      console.log(`  ${bold("Demographics")}`);
      console.log(`    ${dim(parts.join("  ·  "))}`);
    }
  }
}

export function help() {
  console.log(heading("Oikotie CLI"));
  console.log(`  ${bold("stats")}                          ${dim("Database overview")}`);
  console.log(`  ${bold("search")} ${dim("[options]")}               ${dim("Search listings")}`);
  console.log(`    ${dim("--city=Helsinki")}`);
  console.log(`    ${dim("--district=Kallio")}`);
  console.log(`    ${dim("--type=rent|sale")}`);
  console.log(`    ${dim("--min-price=500 --max-price=1000")}`);
  console.log(`    ${dim("--min-size=30 --max-size=60")}`);
  console.log(`    ${dim("--rooms=2")}`);
  console.log(`    ${dim("--sort=price|size_m2|visits|published_at")}`);
  console.log(`    ${dim("--limit=20 --offset=0")}`);
  console.log(`  ${bold("listing")} ${dim("<id>")}                   ${dim("Full listing detail")}`);
  console.log(`  ${bold("regions")} ${dim("[rent|sale]")}            ${dim("Price stats by region")}`);
  console.log(`  ${bold("deals")} ${dim("[rent|sale] [threshold]")}  ${dim("Find below-market listings")}`);
  console.log(`  ${bold("next")}                           ${dim("Next page of results")}`);
  console.log(`  ${bold("open")} ${dim("<id>")}                     ${dim("Open listing in browser")}`);
  console.log(`  ${bold("help")}                           ${dim("Show this help")}`);
  console.log(`  ${bold("exit")} / ${bold("quit")} / ${bold("q")}              ${dim("Exit")}`);
}
