// Server-only data layer: re-exports the scraper/db/analysis functions that
// read the shared oikotie.db directly. Importing this from a client component
// throws (the "server-only" guard), keeping bun:sqlite off the browser bundle.
import "server-only";

export {
  getStats,
  searchDb,
  getListingById,
  getPriceHistory,
} from "../../../src/db";

export {
  allCitySummaries,
  cityMarket,
  findSmartDeals,
  valuateListing,
  getCityModel,
  findComparables,
  serializeValuation,
  serializeDeal,
  serializeListingRow,
  serializeDetailRow,
  getCostInputs,
  attachLivability,
  scoreLivability,
} from "../../../src/analysis";
export type { CostInputs, Livability } from "../../../src/analysis";

export { getOrFetchDetail } from "../../../src/scraper/details";
export { getAreaProfile } from "../../../src/scraper/client";

import { getAnalysisRows } from "../../../src/analysis";
import { quantile } from "../../../src/analysis";

export const eur = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(n).toLocaleString("fi-FI") + " €";
export const pct = (n: number | null | undefined) =>
  n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%";

/** Histogram of monthly rents/prices for a city, clipped to the 2nd–98th pct. */
export function priceDistribution(type: "rent" | "sale", city: string, binCount = 30) {
  const prices = getAnalysisRows(type, city)
    .map((r) => r.price)
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const lo = quantile(prices, 0.02);
  const hi = quantile(prices, 0.98);
  const median = quantile(prices, 0.5);
  const bins = new Array<number>(binCount).fill(0);
  for (const p of prices) {
    if (p < lo || p > hi) continue;
    const idx = Math.min(binCount - 1, Math.floor(((p - lo) / (hi - lo)) * binCount));
    bins[idx]!++;
  }
  return { bins, lo, hi, median, count: prices.length };
}
