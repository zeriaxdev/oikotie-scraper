// Livability scoring + an offline true-cost estimate, so the deal list can
// be ranked by "a place I'd actually live" and by real monthly cost — not
// just rent. Amenity/condition data comes from listing_details (backfilled);
// missing details degrade gracefully to neutral.

import { getDb } from "../db";
import type { Valuation } from "./model";
import { getSpotPrice, ELECTRICITY_DEFAULTS, estimateAnnualKwh } from "./cost";

const CURRENT_YEAR = new Date().getFullYear();

export type Livability = {
  score: number;
  components: { label: string; value: number; max: number }[];
};

export type LivabilityInput = {
  disqualified: boolean;
  z: number;
  conditionCode: number | null;
  sauna: boolean | null;
  lift: boolean | null;
  hasBalcony: boolean;
  hasTerrace: boolean | null;
  floor: number | null;
  buildYear: number | null;
  /** 0..1 demand percentile (market validation) */
  demandPercentile: number;
};

// Components sum to 100. Transparent and defensible over clever.
export function scoreLivability(i: LivabilityInput): Livability {
  const comps: { label: string; value: number; max: number }[] = [];

  let value = 0;
  if (!i.disqualified) value = Math.min(25, (Math.max(0, -i.z) / 3) * 25);
  comps.push({ label: "Value", value: Math.round(value), max: 25 });

  const condMap: Record<number, number> = { 1: 20, 2: 15, 3: 9, 4: 4, 5: 2 };
  const cond = i.conditionCode != null ? (condMap[i.conditionCode] ?? 10) : 10;
  comps.push({ label: "Condition", value: cond, max: 20 });

  let am = 0;
  if (i.sauna) am += 8;
  if (i.lift) am += 6;
  if (i.hasBalcony || i.hasTerrace) am += 7;
  if (i.floor != null && i.floor >= 2) am += 4; // brighter, quieter
  comps.push({ label: "Amenities", value: Math.min(25, am), max: 25 });

  let age = 8;
  if (i.buildYear && i.buildYear > 1800) {
    const a = CURRENT_YEAR - i.buildYear;
    age = a <= 10 ? 15 : a <= 30 ? 11 : a <= 50 ? 7 : 5;
  }
  comps.push({ label: "Building", value: age, max: 15 });

  comps.push({ label: "Demand", value: Math.round(i.demandPercentile * 15), max: 15 });

  const score = comps.reduce((s, c) => s + c.value, 0);
  return { score: Math.min(100, Math.round(score)), components: comps };
}

type DetailFields = {
  condition_code: number | null;
  sauna: number | null;
  lift: number | null;
  balcony_info: string | null;
  has_terrace: number | null;
  water_fee: number | null;
};

function getDetailFields(ids: number[]): Map<number, DetailFields> {
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT listing_id, condition_code, sauna, lift, balcony_info, has_terrace, water_fee
       FROM listing_details WHERE listing_id IN (${placeholders})`,
    )
    .all(...ids) as (DetailFields & { listing_id: number })[];
  const map = new Map<number, DetailFields>();
  for (const r of rows) map.set(r.listing_id, r);
  return map;
}

/** Offline approximation of monthly insurance from size (real value via If on the listing page). */
function approxInsurance(sizeM2: number): number {
  return Math.round(9.5 + 0.07 * sizeM2);
}

export type EnrichedDeal = Valuation & {
  livability: Livability;
  /** offline estimate of total monthly cost for a 1-person household */
  trueCost: number;
};

export async function attachLivability(deals: Valuation[]): Promise<EnrichedDeal[]> {
  const detailMap = getDetailFields(deals.map((d) => d.row.id));
  const spot = await getSpotPrice().catch(() => null);
  const e = ELECTRICITY_DEFAULTS;

  return deals.map((d) => {
    const det = detailMap.get(d.row.id);
    const livability = scoreLivability({
      disqualified: d.disqualified,
      z: d.z,
      conditionCode: det?.condition_code ?? null,
      sauna: det?.sauna == null ? null : !!det.sauna,
      lift: det?.lift == null ? null : !!det.lift,
      hasBalcony: !!det?.balcony_info,
      hasTerrace: det?.has_terrace == null ? null : !!det.has_terrace,
      floor: d.row.floor,
      buildYear: d.row.build_year,
      demandPercentile: d.demandPercentile,
    });

    const size = d.row.size_m2;
    const monthlyKwh = estimateAnnualKwh(size, 1, false) / 12;
    const electricity = spot
      ? monthlyKwh * (spot.avgEurPerKwh + 0.004 + e.transferPerKwh + e.taxPerKwh) + e.transferBasic + e.contractBasic
      : 0;
    const water = det?.water_fee ?? 22;
    const trueCost = Math.round((d.row.price ?? 0) + water + electricity + approxInsurance(size));

    return { ...d, livability, trueCost };
  });
}
