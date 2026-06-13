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
  serializeListingRow,
  serializeDetailRow,
} from "../../../src/analysis";

export { getOrFetchDetail } from "../../../src/scraper/details";

export const eur = (n: number | null | undefined) =>
  n == null ? "—" : Math.round(n).toLocaleString("fi-FI") + " €";
export const pct = (n: number | null | undefined) =>
  n == null ? "—" : (n > 0 ? "+" : "") + n.toFixed(1) + "%";
