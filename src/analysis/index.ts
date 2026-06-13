export {
  getCityModel,
  getAllCityModels,
  valuate,
  valuateListing,
  findSmartDeals,
  findComparables,
  predictPrice,
  districtPremium,
  getAnalysisRows,
} from "./model";

export type { CityModel, Valuation, Confidence, AnalysisRow, DealOptions } from "./model";

export { cityMarket, allCitySummaries } from "./market";
export type { CityMarket, DistrictMarket, SizeBandStats, CitySummary } from "./market";

export { mean, median, quantile, madSigma, percentileRank, olsFit, sparkline } from "./stats";

export { serializeValuation, serializeListingRow, serializeDetailRow, verdictFor } from "./serialize";

export {
  getCostInputs,
  getSpotPrice,
  getInsuranceMonthly,
  estimateAnnualKwh,
  ELECTRICITY_DEFAULTS,
  PROVIDERS,
} from "./cost";
export type { CostInputs, SpotPrice, Provider } from "./cost";
