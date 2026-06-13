// True monthly-cost inputs: live electricity spot price, home insurance
// (Oikotie's anonymous If widget), and an electricity-consumption model.
// All network calls are cached in-process with a short TTL.

import { getTokens } from "../scraper/client";

const BASE = "https://asunnot.oikotie.fi";

type Cache<T> = { value: T; at: number };
function cached<T>(ttlMs: number) {
  let c: Cache<T> | null = null;
  return {
    async get(load: () => Promise<T>): Promise<T> {
      if (c && Date.now() - c.at < ttlMs) return c.value;
      const value = await load();
      c = { value, at: Date.now() };
      return value;
    },
  };
}

// --- Electricity spot price (sähkönhintatanaan, Nord Pool FI) ---

export type SpotPrice = {
  /** day-average €/kWh (VAT-excl spot) */
  avgEurPerKwh: number;
  /** current hour €/kWh */
  nowEurPerKwh: number;
  min: number;
  max: number;
  /** 24 hourly €/kWh for a sparkline */
  hours: number[];
  date: string;
};

const spotCache = cached<SpotPrice>(60 * 60 * 1000);

export function getSpotPrice(): Promise<SpotPrice> {
  return spotCache.get(async () => {
    const now = new Date();
    const y = now.getFullYear();
    const md = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const res = await fetch(`https://www.sahkonhintatanaan.fi/api/v1/prices/${y}/${md}.json`, {
      headers: { "user-agent": "Mozilla/5.0", accept: "application/json" },
    });
    if (!res.ok) throw new Error(`spot price ${res.status}`);
    const rows = (await res.json()) as { EUR_per_kWh: number; time_start: string }[];
    const hours = rows.map((r) => r.EUR_per_kWh);
    const avg = hours.reduce((s, x) => s + x, 0) / Math.max(1, hours.length);
    const hourIdx = rows.findIndex((r) => new Date(r.time_start).getHours() === now.getHours());
    return {
      avgEurPerKwh: avg,
      nowEurPerKwh: hours[hourIdx >= 0 ? hourIdx : 0] ?? avg,
      min: Math.min(...hours),
      max: Math.max(...hours),
      hours,
      date: `${y}-${md}`,
    };
  });
}

// --- Home insurance (If) via Oikotie's anonymous widget ---

const insuranceCache = new Map<number, number>();

export async function getInsuranceMonthly(sizeM2: number): Promise<number | null> {
  const key = Math.round(sizeM2);
  if (insuranceCache.has(key)) return insuranceCache.get(key)!;
  try {
    const t = await getTokens();
    const res = await fetch(`${BASE}/api/latest/widgets/if/calculate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Mozilla/5.0 Chrome/148",
        "ota-token": t.token,
        "ota-loaded": t.loaded,
        "ota-cuid": t.cuid,
        origin: BASE,
        referer: `${BASE}/vuokra-asunnot`,
      },
      body: JSON.stringify({ size: key, type: "home" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { price?: number };
    const price = typeof data.price === "number" ? data.price : null;
    if (price != null) insuranceCache.set(key, price);
    return price;
  } catch {
    return null;
  }
}

// --- Electricity consumption + cost model ---

// Finnish fixed components (approx, VAT incl). Tunable client-side.
export const ELECTRICITY_DEFAULTS = {
  /** grid transfer energy charge €/kWh (siirto) */
  transferPerKwh: 0.05,
  /** electricity tax €/kWh (sähkövero, class I) */
  taxPerKwh: 0.0283,
  /** grid basic fee €/mo (perusmaksu) */
  transferBasic: 8,
  /** energy contract basic fee €/mo */
  contractBasic: 4,
};

/** Annual kWh for a district-heated apartment by persons + size. */
export function estimateAnnualKwh(sizeM2: number, persons: number, electricHeating: boolean): number {
  const base = 1200 + 350 * persons + 8 * sizeM2;
  return electricHeating ? base + 100 * sizeM2 : base;
}

// Spot-price ("pörssisähkö") providers: margin added to spot + monthly fee.
// Approximate public figures — illustrative, verify before switching.
export type Provider = { id: string; name: string; marginPerKwh: number; basic: number; color: string };
export const PROVIDERS: Provider[] = [
  { id: "vare", name: "Väre", marginPerKwh: 0.004, basic: 3.9, color: "#e2001a" },
  { id: "helen", name: "Helen", marginPerKwh: 0.003, basic: 4.9, color: "#00a8e1" },
  { id: "fortum", name: "Fortum", marginPerKwh: 0.0035, basic: 3.49, color: "#ff9b00" },
  { id: "lumme", name: "Lumme Energia", marginPerKwh: 0.0042, basic: 3.5, color: "#0a6bd6" },
  { id: "oomi", name: "Oomi", marginPerKwh: 0.0049, basic: 3.95, color: "#7b2cbf" },
];

export type CostInputs = {
  rent: number | null;
  maintenanceFee: number | null;
  /** water €/person/month from the listing, or null */
  waterPerPerson: number | null;
  insuranceMonthly: number | null;
  sizeM2: number;
  spot: SpotPrice;
  electricity: typeof ELECTRICITY_DEFAULTS;
  providers: Provider[];
  /** default electric-heating guess from the listing's heating text */
  electricHeating: boolean;
};

export async function getCostInputs(args: {
  id: number;
  rent: number | null;
  maintenanceFee: number | null;
  waterPerPerson: number | null;
  sizeM2: number;
  electricHeating: boolean;
}): Promise<CostInputs> {
  const [spot, insuranceMonthly] = await Promise.all([
    getSpotPrice(),
    getInsuranceMonthly(args.sizeM2),
  ]);
  return {
    rent: args.rent,
    maintenanceFee: args.maintenanceFee,
    waterPerPerson: args.waterPerPerson,
    insuranceMonthly,
    sizeM2: args.sizeM2,
    spot,
    electricity: ELECTRICITY_DEFAULTS,
    providers: PROVIDERS,
    electricHeating: args.electricHeating,
  };
}
