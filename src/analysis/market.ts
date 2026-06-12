// Market-level descriptive statistics built on the same analysis rows
// as the hedonic model, plus model-derived district premiums.

import {
  getAnalysisRows,
  getCityModel,
  districtPremium,
  type AnalysisRow,
} from "./model";
import { median, quantile, sparkline } from "./stats";

export type SizeBandStats = {
  band: string;
  count: number;
  medianPrice: number;
  medianPpm2: number;
};

export type DistrictMarket = {
  district: string;
  count: number;
  medianPrice: number;
  medianPpm2: number;
  p25Ppm2: number;
  p75Ppm2: number;
  /** model-derived premium vs city baseline, null when no dummy was fit */
  premium: number | null;
  medianVisitsWeekly: number;
};

export type CityMarket = {
  city: string;
  count: number;
  medianPrice: number;
  medianPpm2: number;
  p25Price: number;
  p75Price: number;
  priceSparkline: string;
  modelR2: number | null;
  sizeBands: SizeBandStats[];
  districts: DistrictMarket[];
};

const SIZE_BANDS: { band: string; min: number; max: number }[] = [
  { band: "≤ 30 m²", min: 0, max: 30 },
  { band: "30–50 m²", min: 30, max: 50 },
  { band: "50–70 m²", min: 50, max: 70 },
  { band: "70–90 m²", min: 70, max: 90 },
  { band: "90+ m²", min: 90, max: Infinity },
];

function ppm2(r: AnalysisRow): number {
  return r.price / r.size_m2;
}

export function cityMarket(type: "rent" | "sale", city: string): CityMarket | null {
  const rows = getAnalysisRows(type, city);
  if (rows.length === 0) return null;

  const prices = rows.map((r) => r.price);
  const model = getCityModel(type, city);

  const sizeBands: SizeBandStats[] = [];
  for (const { band, min, max } of SIZE_BANDS) {
    const inBand = rows.filter((r) => r.size_m2 > min && r.size_m2 <= max);
    if (inBand.length < 3) continue;
    sizeBands.push({
      band,
      count: inBand.length,
      medianPrice: median(inBand.map((r) => r.price)),
      medianPpm2: median(inBand.map(ppm2)),
    });
  }

  const byDistrict = new Map<string, AnalysisRow[]>();
  for (const r of rows) {
    if (!r.district) continue;
    const arr = byDistrict.get(r.district) ?? [];
    arr.push(r);
    byDistrict.set(r.district, arr);
  }

  const districts: DistrictMarket[] = [];
  for (const [district, dRows] of byDistrict) {
    if (dRows.length < 3) continue;
    const dPpm2 = dRows.map(ppm2);
    districts.push({
      district,
      count: dRows.length,
      medianPrice: median(dRows.map((r) => r.price)),
      medianPpm2: median(dPpm2),
      p25Ppm2: quantile(dPpm2, 0.25),
      p75Ppm2: quantile(dPpm2, 0.75),
      premium: model ? districtPremium(model, district) : null,
      medianVisitsWeekly: median(dRows.map((r) => r.visits_weekly)),
    });
  }
  districts.sort((a, b) => b.medianPpm2 - a.medianPpm2);

  return {
    city,
    count: rows.length,
    medianPrice: median(prices),
    medianPpm2: median(rows.map(ppm2)),
    p25Price: quantile(prices, 0.25),
    p75Price: quantile(prices, 0.75),
    priceSparkline: sparkline(prices),
    modelR2: model?.r2 ?? null,
    sizeBands,
    districts,
  };
}

export type CitySummary = {
  city: string;
  count: number;
  medianPrice: number;
  medianPpm2: number;
  modelR2: number | null;
};

export function allCitySummaries(type: "rent" | "sale"): CitySummary[] {
  const rows = getAnalysisRows(type);
  const byCity = new Map<string, AnalysisRow[]>();
  for (const r of rows) {
    if (!r.city) continue;
    const arr = byCity.get(r.city) ?? [];
    arr.push(r);
    byCity.set(r.city, arr);
  }

  const summaries: CitySummary[] = [];
  for (const [city, cityRows] of byCity) {
    summaries.push({
      city,
      count: cityRows.length,
      medianPrice: median(cityRows.map((r) => r.price)),
      medianPpm2: median(cityRows.map(ppm2)),
      modelR2: getCityModel(type, city)?.r2 ?? null,
    });
  }
  summaries.sort((a, b) => b.count - a.count);
  return summaries;
}
