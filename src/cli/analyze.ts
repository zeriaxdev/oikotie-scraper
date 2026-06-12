import {
  valuateListing,
  findSmartDeals,
  findComparables,
  getCityModel,
  districtPremium,
  cityMarket,
  allCitySummaries,
  type Valuation,
} from "../analysis";
import { getPriceHistory } from "../db";
import {
  table,
  heading,
  kv,
  money,
  m2,
  bold,
  dim,
  green,
  red,
  yellow,
  cyan,
  truncate,
  type Column,
} from "./format";

function edgeFmt(edge: number): string {
  const s = `${edge > 0 ? "+" : ""}${(edge * 100).toFixed(1)}%`;
  return edge < -0.02 ? green(s) : edge > 0.02 ? red(s) : yellow(s);
}

function verdict(z: number): string {
  if (z <= -2) return green("significantly below market");
  if (z <= -1) return green("below market");
  if (z < 1) return yellow("fair price");
  if (z < 2) return red("above market");
  return red("significantly above market");
}

function confFmt(conf: string): string {
  return conf === "high" ? green(conf) : conf === "medium" ? yellow(conf) : dim(conf);
}

function ordinal(p: number): string {
  const n = Math.round(p * 100);
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

export function analyze(id: number) {
  const v = valuateListing(id);
  if (!v) {
    console.log(
      red(`  Cannot analyze ${id}: listing not found, missing price/size, or too little data for its city.`),
    );
    return;
  }
  const { row } = v;
  const model = row.city ? getCityModel(row.type, row.city) : null;
  // 68% band: one robust sigma in log space, converted to euros
  const band = model ? Math.round(v.expectedPrice * (Math.exp(model.residSigma) - 1)) : null;

  console.log(heading(`Valuation — listing ${id}`));
  console.log(`  ${bold(String(row.address ?? "Unknown address"))}`);
  console.log(
    `  ${dim([row.district, row.city, row.room_config, row.size_m2 ? `${row.size_m2} m²` : null].filter(Boolean).join(" · "))}`,
  );
  console.log();
  console.log(kv("Asking price", money(row.price)));
  console.log(
    kv(
      "Model estimate",
      `${money(Math.round(v.expectedPrice))}${band != null ? ` ${dim(`± ${band.toLocaleString("fi-FI")} €`)}` : ""}`,
    ),
  );
  console.log(kv("Edge vs market", `${edgeFmt(v.edge)}  ${dim(`z = ${v.z.toFixed(2)}`)}`));
  console.log(kv("Verdict", verdict(v.z)));
  console.log(kv("Confidence", `${confFmt(v.confidence)} ${dim(`(model R² ${v.model.r2.toFixed(2)}, n=${v.model.n}, district n=${v.model.districtN})`)}`));
  if (v.districtPercentile != null) {
    console.log(kv("€/m² in district", `${(row.price / row.size_m2).toFixed(1)} €/m² — ${ordinal(v.districtPercentile)} percentile`));
  }
  console.log(kv("Demand", `${row.visits_weekly} views this week — ${ordinal(v.demandPercentile)} percentile in ${row.city}`));
  if (v.flags.length) {
    console.log(kv("Flags", v.flags.map((f) => yellow(f)).join(" ")));
  }
  console.log(kv("Deal score", `${v.dealScore}/100`));

  if (model && row.district) {
    const premium = districtPremium(model, row.district);
    if (premium != null) {
      const sign = premium > 0 ? "+" : "";
      console.log(kv(`${row.district} premium`, `${sign}${(premium * 100).toFixed(1)}% vs ${row.city} baseline`));
    }
  }

  if (model) {
    const comps = findComparables(model, row);
    if (comps.length > 0) {
      console.log(heading("Closest Comparables"));
      const cols: Column[] = [
        { key: "id", label: "ID", width: 10 },
        { key: "address", label: "Address", width: 24, format: (val) => truncate(val as string, 24) },
        { key: "room_config", label: "Config", width: 12 },
        { key: "size_m2", label: "Size", width: 8, align: "right", format: (val) => m2(val as number) },
        { key: "price", label: "Price", width: 10, align: "right", format: (val) => money(val as number) },
        {
          key: "ppm2",
          label: "€/m²",
          width: 8,
          align: "right",
          format: (_val, r) => ((r.price as number) / (r.size_m2 as number)).toFixed(1),
        },
      ];
      console.log(table(comps as unknown as Record<string, unknown>[], cols));
    }
  }

  const history = getPriceHistory(id);
  if (history.length > 1) {
    console.log(heading("Price History"));
    for (const h of history) {
      console.log(`  ${dim(h.scrapedAt)}  ${money(h.price)}`);
    }
  }
}

export function deals(
  type: "rent" | "sale" = "rent",
  opts: { city?: string; minScore?: number; limit?: number; includeSuspicious?: boolean } = {},
) {
  const results = findSmartDeals(type, opts);

  console.log(heading(`Deals (${type}${opts.city ? `, ${opts.city}` : ""}) — hedonic model residuals`));

  const cols: Column[] = [
    { key: "dealScore", label: "Score", width: 5, align: "right", format: (val) => bold(String(val)) },
    { key: "id", label: "ID", width: 10, format: (_val, r) => String((r.row as Record<string, unknown>).id) },
    { key: "city", label: "City", width: 11, format: (_val, r) => String((r.row as Record<string, unknown>).city ?? "") },
    { key: "district", label: "District", width: 14, format: (_val, r) => truncate(String((r.row as Record<string, unknown>).district ?? ""), 14) },
    { key: "price", label: "Price", width: 9, align: "right", format: (_val, r) => money((r.row as Record<string, unknown>).price as number) },
    { key: "expectedPrice", label: "Est.", width: 9, align: "right", format: (val) => money(Math.round(val as number)) },
    { key: "edge", label: "Edge", width: 7, align: "right", format: (val) => edgeFmt(val as number) },
    { key: "z", label: "z", width: 5, align: "right", format: (val) => (val as number).toFixed(1) },
    { key: "size", label: "Size", width: 7, align: "right", format: (_val, r) => m2((r.row as Record<string, unknown>).size_m2 as number) },
    { key: "confidence", label: "Conf", width: 6, format: (val) => confFmt(val as string) },
    { key: "flags", label: "Flags", width: 14, format: (val) => dim((val as string[]).join(" ")) },
  ];

  console.log(table(results as unknown as Record<string, unknown>[], cols));
  console.log(
    dim(
      `  ${results.length} deals · edge = asking vs model estimate · z = robust deviations below market\n  Drill down with ${cyan("analyze <id>")}`,
    ),
  );
}

export function market(type: "rent" | "sale" = "rent", city?: string) {
  if (!city) {
    const summaries = allCitySummaries(type);
    console.log(heading(`Market Overview (${type})`));
    const cols: Column[] = [
      { key: "city", label: "City", width: 16 },
      { key: "count", label: "Listings", width: 8, align: "right" },
      { key: "medianPrice", label: "Median €", width: 10, align: "right", format: (val) => money(Math.round(val as number)) },
      { key: "medianPpm2", label: "€/m²", width: 8, align: "right", format: (val) => (val as number).toFixed(1) },
      {
        key: "modelR2",
        label: "Model R²",
        width: 8,
        align: "right",
        format: (val) => (val == null ? dim("—") : (val as number).toFixed(2)),
      },
    ];
    console.log(table(summaries as unknown as Record<string, unknown>[], cols));
    console.log(dim(`  Drill into a city with ${cyan("market <city>")}`));
    return;
  }

  const mkt = cityMarket(type, city);
  if (!mkt) {
    console.log(red(`  No data for ${city} (${type}).`));
    return;
  }

  console.log(heading(`${mkt.city} Market (${type})`));
  console.log(kv("Listings", String(mkt.count)));
  console.log(kv("Median price", money(Math.round(mkt.medianPrice))));
  console.log(kv("P25–P75", `${money(Math.round(mkt.p25Price))} – ${money(Math.round(mkt.p75Price))}`));
  console.log(kv("Median €/m²", mkt.medianPpm2.toFixed(1)));
  console.log(kv("Distribution", mkt.priceSparkline));
  if (mkt.modelR2 != null) {
    console.log(kv("Model fit", `R² ${mkt.modelR2.toFixed(2)}`));
  }

  if (mkt.sizeBands.length > 0) {
    console.log(heading("By Size"));
    const cols: Column[] = [
      { key: "band", label: "Size band", width: 10 },
      { key: "count", label: "#", width: 5, align: "right" },
      { key: "medianPrice", label: "Median €", width: 10, align: "right", format: (val) => money(Math.round(val as number)) },
      { key: "medianPpm2", label: "€/m²", width: 8, align: "right", format: (val) => (val as number).toFixed(1) },
    ];
    console.log(table(mkt.sizeBands as unknown as Record<string, unknown>[], cols));
    console.log(dim("  Small apartments always cost more per m² — compare within a band, not across."));
  }

  if (mkt.districts.length > 0) {
    console.log(heading("Districts — priciest first"));
    const cols: Column[] = [
      { key: "district", label: "District", width: 18, format: (val) => truncate(val as string, 18) },
      { key: "count", label: "#", width: 5, align: "right" },
      { key: "medianPrice", label: "Median €", width: 10, align: "right", format: (val) => money(Math.round(val as number)) },
      { key: "medianPpm2", label: "€/m²", width: 8, align: "right", format: (val) => (val as number).toFixed(1) },
      {
        key: "p25Ppm2",
        label: "IQR €/m²",
        width: 13,
        align: "right",
        format: (_val, r) => `${(r.p25Ppm2 as number).toFixed(0)}–${(r.p75Ppm2 as number).toFixed(0)}`,
      },
      {
        key: "premium",
        label: "Premium",
        width: 8,
        align: "right",
        format: (val) => (val == null ? dim("—") : edgeFmt(val as number)),
      },
      { key: "medianVisitsWeekly", label: "Views/wk", width: 8, align: "right" },
    ];
    console.log(table(mkt.districts as unknown as Record<string, unknown>[], cols));
    console.log(
      dim(
        "  Premium = what the hedonic model attributes to location alone, controlling for size, rooms, age and floor.",
      ),
    );
  }
}
