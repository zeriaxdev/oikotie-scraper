// Hedonic pricing model.
//
// For each (type, city) with enough data we regress log(price) on
// log(size), rooms, building age, floor position and district fixed
// effects. A listing's "expected price" is what the model predicts for
// its attributes; the gap between actual and expected — measured as a
// robust z-score against the residual distribution — is the deal signal.
//
// Fitting is two-pass: fit OLS, drop |z| > 2.5 outliers (shared flats,
// typos, luxury one-offs), refit on the inliers. Predictions are
// bias-corrected with Duan's smearing estimator since we model in logs.

import { getDb } from "../db";
import { madSigma, median, olsFit, percentileRank } from "./stats";

export type AnalysisRow = {
  id: number;
  url: string;
  type: "rent" | "sale";
  price: number;
  size_m2: number;
  rooms: number | null;
  room_config: string | null;
  build_year: number | null;
  floor: number | null;
  total_floors: number | null;
  address: string | null;
  district: string | null;
  city: string | null;
  visits: number;
  visits_weekly: number;
  published_at: string | null;
  price_changed_at: string | null;
  description: string | null;
};

// Finnish description red-flags that explain an "underpriced" listing away:
// it isn't a whole standard apartment at that price. These disqualify a deal.
const RED_FLAG_PATTERNS: { flag: string; re: RegExp }[] = [
  { flag: "renovation", re: /remont|saneeraus|peruskorja|putkiremont|linjasaneer|kunnostett.{0,12}vuo/i },
  { flag: "short-term", re: /lyhytaikai|väliaikai|tilapäis|sijaisasun|kuukauden ajaksi/i },
  { flag: "sublet", re: /alivuokra|edelleenvuokra/i },
  { flag: "shared", re: /soluasun|soluhuone|solupaik|kimppakämp|kimppa-asun|jaettu asun|jaettava asun/i },
];

export function descriptionRedFlags(text: string | null): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const { flag, re } of RED_FLAG_PATTERNS) if (re.test(text)) out.push(flag);
  return out;
}

/** The API returns inconsistent casing ("HELSINKI", "helsinki"); fold to one form. */
export function normalizeCity(city: string | null): string | null {
  if (!city) return null;
  return city
    .toLocaleLowerCase("fi-FI")
    .replace(/(^|[\s-])\p{L}/gu, (ch) => ch.toLocaleUpperCase("fi-FI"));
}

export function getAnalysisRows(type: "rent" | "sale", city?: string): AnalysisRow[] {
  const cityCond = city ? "AND city = $city COLLATE NOCASE" : "";
  const params: Record<string, string> = { $type: type };
  if (city) params.$city = city;
  const rows = getDb()
    .prepare(
      `SELECT id, url, type, price, size_m2, rooms, room_config, build_year,
              floor, total_floors, address, district, city,
              visits, visits_weekly, published_at, price_changed_at, description
       FROM listings
       WHERE type = $type AND price > 0 AND size_m2 >= 9 ${cityCond}`,
    )
    .all(params) as AnalysisRow[];
  for (const r of rows) r.city = normalizeCity(r.city);
  return rows;
}

const MIN_CITY_ROWS = 40;
const MIN_DISTRICT_ROWS_FOR_DUMMY = 5;
const OUTLIER_Z = 2.5;

export type CityModel = {
  city: string;
  type: "rent" | "sale";
  n: number;
  nUsed: number;
  r2: number;
  /** Robust spread of log-residuals; the unit of the deal z-score. */
  residSigma: number;
  /** Duan smearing factor: corrects exp() bias when predicting in logs. */
  smearing: number;
  beta: number[];
  /** district name -> column index in the design matrix */
  districtIdx: Map<string, number>;
  imputed: { age: number; floorRatio: number; rooms: number };
  rows: AnalysisRow[];
  /** log-residual per row id (inliers and outliers alike, from final fit) */
  residualById: Map<number, number>;
};

const CURRENT_YEAR = new Date().getFullYear();
const NUM_BASE_FEATURES = 6; // intercept, log(size), rooms, age, age², floorRatio

function designRow(row: AnalysisRow, model: Pick<CityModel, "districtIdx" | "imputed">): number[] {
  const p = NUM_BASE_FEATURES + model.districtIdx.size;
  const x = new Array<number>(p).fill(0);
  const age =
    row.build_year && row.build_year > 1800 && row.build_year <= CURRENT_YEAR + 5
      ? (CURRENT_YEAR - row.build_year) / 10
      : model.imputed.age;
  const floorRatio =
    row.floor != null && row.total_floors ? row.floor / row.total_floors : model.imputed.floorRatio;

  x[0] = 1;
  x[1] = Math.log(row.size_m2);
  x[2] = row.rooms ?? model.imputed.rooms;
  x[3] = age;
  x[4] = age * age;
  x[5] = Math.min(1.5, Math.max(0, floorRatio));

  const dIdx = row.district ? model.districtIdx.get(row.district) : undefined;
  if (dIdx != null) x[dIdx] = 1;
  return x;
}

function fitCity(type: "rent" | "sale", city: string, rows: AnalysisRow[]): CityModel | null {
  if (rows.length < MIN_CITY_ROWS) return null;

  const districtCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.district) districtCounts.set(r.district, (districtCounts.get(r.district) ?? 0) + 1);
  }
  const districtIdx = new Map<string, number>();
  let col = NUM_BASE_FEATURES;
  for (const [district, count] of districtCounts) {
    if (count >= MIN_DISTRICT_ROWS_FOR_DUMMY) districtIdx.set(district, col++);
  }

  const imputed = {
    age: median(
      rows
        .filter((r) => r.build_year && r.build_year > 1800)
        .map((r) => (CURRENT_YEAR - r.build_year!) / 10),
    ) || 4,
    floorRatio: 0.5,
    rooms: median(rows.filter((r) => r.rooms != null).map((r) => r.rooms!)) || 2,
  };

  if (rows.length < NUM_BASE_FEATURES + districtIdx.size + 10) return null;

  const partial = { districtIdx, imputed };
  const X = rows.map((r) => designRow(r, partial));
  const y = rows.map((r) => Math.log(r.price));

  // Pass 1: find outliers
  const first = olsFit(X, y);
  const sigma1 = madSigma(first.residuals, median(first.residuals)) || first.sigma;
  const inlier = first.residuals.map((r) => Math.abs(r) <= OUTLIER_Z * sigma1);

  // Pass 2: refit on inliers
  const Xin = X.filter((_, i) => inlier[i]);
  const yin = y.filter((_, i) => inlier[i]);
  if (Xin.length < NUM_BASE_FEATURES + districtIdx.size + 10) return null;
  const fit = olsFit(Xin, yin);

  // Residuals for ALL rows against the final fit
  const residualById = new Map<number, number>();
  const inlierResiduals: number[] = [];
  let smearingSum = 0;
  for (let i = 0; i < rows.length; i++) {
    let pred = 0;
    const xi = X[i]!;
    for (let j = 0; j < fit.beta.length; j++) pred += fit.beta[j]! * xi[j]!;
    const resid = y[i]! - pred;
    residualById.set(rows[i]!.id, resid);
    if (inlier[i]) {
      inlierResiduals.push(resid);
      smearingSum += Math.exp(resid);
    }
  }

  return {
    city,
    type,
    n: rows.length,
    nUsed: Xin.length,
    r2: fit.r2,
    residSigma: madSigma(inlierResiduals) || fit.sigma,
    smearing: smearingSum / Math.max(1, inlierResiduals.length),
    beta: fit.beta,
    districtIdx,
    imputed,
    rows,
    residualById,
  };
}

// Model cache: built once per process per (type, city)
const modelCache = new Map<string, CityModel | null>();

export function getCityModel(type: "rent" | "sale", rawCity: string): CityModel | null {
  const city = normalizeCity(rawCity)!;
  const key = `${type}|${city}`;
  if (!modelCache.has(key)) {
    modelCache.set(key, fitCity(type, city, getAnalysisRows(type, city)));
  }
  return modelCache.get(key) ?? null;
}

export function getAllCityModels(type: "rent" | "sale"): CityModel[] {
  const rows = getAnalysisRows(type);
  const byCity = new Map<string, AnalysisRow[]>();
  for (const r of rows) {
    if (!r.city) continue;
    const arr = byCity.get(r.city) ?? [];
    arr.push(r);
    byCity.set(r.city, arr);
  }
  const models: CityModel[] = [];
  for (const [city, cityRows] of byCity) {
    const key = `${type}|${city}`;
    if (!modelCache.has(key)) modelCache.set(key, fitCity(type, city, cityRows));
    const m = modelCache.get(key);
    if (m) models.push(m);
  }
  return models;
}

export function predictPrice(model: CityModel, row: AnalysisRow): number {
  const x = designRow(row, model);
  let logPred = 0;
  for (let j = 0; j < model.beta.length; j++) logPred += model.beta[j]! * x[j]!;
  return Math.exp(logPred) * model.smearing;
}

/** District premium over the city baseline, e.g. 0.18 = +18%. */
export function districtPremium(model: CityModel, district: string): number | null {
  const idx = model.districtIdx.get(district);
  if (idx == null) return null;
  return Math.exp(model.beta[idx]!) - 1;
}

// --- Valuation ---

export type Confidence = "high" | "medium" | "low";

export type Valuation = {
  row: AnalysisRow;
  expectedPrice: number;
  /** actual/expected - 1; negative = cheaper than expected */
  edge: number;
  /** robust z-score of the log-residual; negative = underpriced */
  z: number;
  /** €/m² percentile within the district cohort (0..1) */
  districtPercentile: number | null;
  /** visits_weekly percentile within the city (0..1) */
  demandPercentile: number;
  confidence: Confidence;
  flags: string[];
  /** the listing isn't a comparable whole apartment (renovation/sublet/shared/etc.) */
  disqualified: boolean;
  /** composite 0-100, only meaningful for underpriced listings */
  dealScore: number;
  model: { r2: number; n: number; districtN: number };
};

export function valuate(model: CityModel, row: AnalysisRow): Valuation {
  const expectedPrice = predictPrice(model, row);
  const edge = row.price / expectedPrice - 1;
  const logResid = Math.log(row.price) - Math.log(expectedPrice / model.smearing);
  const z = logResid / model.residSigma;

  const districtRows = row.district
    ? model.rows.filter((r) => r.district === row.district)
    : [];
  const districtN = districtRows.length;
  const districtPercentile =
    districtN >= 5
      ? percentileRank(
          districtRows.map((r) => r.price / r.size_m2),
          row.price / row.size_m2,
        )
      : null;

  const demandPercentile = percentileRank(
    model.rows.map((r) => r.visits_weekly),
    row.visits_weekly,
  );

  const flags: string[] = [];
  // Description red-flags explain the discount away — not a real deal.
  const redFlags = descriptionRedFlags(row.description);
  flags.push(...redFlags);
  if (edge < -0.45) flags.push("suspicious"); // >45% under model — likely a room/shared flat or data error
  if (row.price_changed_at) flags.push("price-drop");
  if (row.published_at && Date.now() - Date.parse(row.published_at) < 7 * 86_400_000) {
    flags.push("new");
  }
  const disqualified = redFlags.length > 0 || edge < -0.45;

  let confidence: Confidence;
  if (model.r2 >= 0.6 && districtN >= 20) confidence = "high";
  else if (model.r2 >= 0.45 && districtN >= 8) confidence = "medium";
  else confidence = "low";

  // Composite score: edge size (55), statistical significance (20),
  // confidence (15), demand validation (10). Disqualified listings capped low.
  const edgePts = Math.min(1, Math.max(0, -edge) / 0.3) * 55;
  const sigPts = Math.min(1, Math.max(0, -z) / 3) * 20;
  const confPts = confidence === "high" ? 15 : confidence === "medium" ? 9 : 3;
  const demandPts = demandPercentile * 10;
  let dealScore = Math.round(edgePts + sigPts + confPts + demandPts);
  if (disqualified) dealScore = Math.min(dealScore, 25);

  return {
    row,
    expectedPrice,
    edge,
    z,
    districtPercentile,
    demandPercentile,
    confidence,
    flags,
    disqualified,
    dealScore,
    model: { r2: model.r2, n: model.nUsed, districtN },
  };
}

export type DealOptions = {
  city?: string;
  district?: string;
  minScore?: number;
  limit?: number;
  /** include renovation/sublet/shared/suspicious listings (off by default) */
  includeFlagged?: boolean;
};

export function findSmartDeals(type: "rent" | "sale", opts: DealOptions = {}): Valuation[] {
  const models = opts.city
    ? [getCityModel(type, opts.city)].filter((m): m is CityModel => m != null)
    : getAllCityModels(type);
  const district = opts.district?.toLowerCase();

  const deals: Valuation[] = [];
  for (const model of models) {
    for (const row of model.rows) {
      if (district && row.district?.toLowerCase() !== district) continue;
      const v = valuate(model, row);
      if (v.z > -1) continue; // not meaningfully below market
      if (!opts.includeFlagged && v.disqualified) continue;
      if (v.dealScore < (opts.minScore ?? 40)) continue;
      deals.push(v);
    }
  }

  deals.sort((a, b) => b.dealScore - a.dealScore);
  return deals.slice(0, opts.limit ?? 30);
}

/** Valuate a single listing by id. Returns null if no model covers its city. */
export function valuateListing(id: number): Valuation | null {
  const row = getDb()
    .prepare(
      `SELECT id, url, type, price, size_m2, rooms, room_config, build_year,
              floor, total_floors, address, district, city,
              visits, visits_weekly, published_at, price_changed_at, description
       FROM listings WHERE id = ? AND price > 0 AND size_m2 >= 9`,
    )
    .get(id) as AnalysisRow | null;
  if (!row?.city) return null;
  row.city = normalizeCity(row.city);

  const model = getCityModel(row.type, row.city!);
  if (!model) return null;
  return valuate(model, row);
}

/** Closest comparables: same district, similar size, similar rooms. */
export function findComparables(model: CityModel, row: AnalysisRow, limit = 6): AnalysisRow[] {
  return model.rows
    .filter(
      (r) =>
        r.id !== row.id &&
        r.district === row.district &&
        (row.rooms == null || r.rooms == null || Math.abs(r.rooms - row.rooms) <= 1),
    )
    .sort(
      (a, b) =>
        Math.abs(Math.log(a.size_m2 / row.size_m2)) - Math.abs(Math.log(b.size_m2 / row.size_m2)),
    )
    .slice(0, limit);
}
