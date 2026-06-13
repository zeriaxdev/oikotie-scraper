// Shared JSON serializers so the MCP server, the HTTP API and any other
// consumer present valuations and listings with identical camelCase shapes.

import type { Valuation } from "./model";
import type { EnrichedDeal } from "./livability";

export function verdictFor(z: number): string {
  if (z <= -2) return "significantly below market";
  if (z <= -1) return "below market";
  if (z < 1) return "fair price";
  if (z < 2) return "above market";
  return "significantly above market";
}

export function serializeValuation(v: Valuation) {
  return {
    id: v.row.id,
    url: v.row.url,
    address: v.row.address,
    district: v.row.district,
    city: v.row.city,
    roomConfig: v.row.room_config,
    sizeM2: v.row.size_m2,
    askingPrice: v.row.price,
    expectedPrice: Math.round(v.expectedPrice),
    edgePercent: Math.round(v.edge * 1000) / 10,
    zScore: Math.round(v.z * 100) / 100,
    verdict: verdictFor(v.z),
    dealScore: v.dealScore,
    confidence: v.confidence,
    flags: v.flags,
    disqualified: v.disqualified,
    districtPpm2Percentile:
      v.districtPercentile != null ? Math.round(v.districtPercentile * 100) : null,
    demandPercentile: Math.round(v.demandPercentile * 100),
    visitsWeekly: v.row.visits_weekly,
    model: v.model,
  };
}

export function serializeDeal(d: EnrichedDeal) {
  return {
    ...serializeValuation(d),
    livability: d.livability.score,
    livabilityComponents: d.livability.components,
    trueCost: d.trueCost,
  };
}

/** Map a raw snake_case listing_details row to a camelCase API object (raw_json omitted). */
export function serializeDetailRow(d: Record<string, unknown> | null) {
  if (!d) return null;
  const bool = (v: unknown) => (v == null ? null : v === 1);
  return {
    title: d.title,
    description: d.description,
    availabilityInfo: d.availability_info,
    availabilityDate: d.availability_date,
    rentTermInfo: d.rent_term_info,
    kitchenAppliances: d.kitchen_appliances,
    bathroomAppliances: d.bathroom_appliances,
    storageInfo: d.storage_info,
    balconyInfo: d.balcony_info,
    hasTerrace: bool(d.has_terrace),
    sauna: bool(d.sauna),
    saunaInfo: d.sauna_info,
    lift: bool(d.lift),
    heatingInfo: d.heating_info,
    waterFee: d.water_fee,
    waterFeeInfo: d.water_fee_info,
    securityDepositInfo: d.security_deposit_info,
    otherTerms: d.other_terms,
    petsAllowedCode: d.pets_allowed_code,
    conditionCode: d.condition_code,
    energyClass: d.energy_class,
    buildingTypeCode: d.building_type_code,
    buildingFloors: d.building_floors,
    updatedAt: d.updated_at,
  };
}

/** Map a raw snake_case listings row to a camelCase API object. */
export function serializeListingRow(l: Record<string, unknown>) {
  return {
    id: l.id,
    url: l.url,
    type: l.type,
    price: l.price,
    priceStr: l.price_str,
    rooms: l.rooms,
    roomConfig: l.room_config,
    sizeM2: l.size_m2,
    pricePerM2:
      l.price != null && (l.size_m2 as number) > 0
        ? Math.round(((l.price as number) / (l.size_m2 as number)) * 10) / 10
        : null,
    buildYear: l.build_year,
    floor: l.floor,
    totalFloors: l.total_floors,
    address: l.address,
    district: l.district,
    city: l.city,
    zipCode: l.zip_code,
    lat: l.lat,
    lng: l.lng,
    description: l.description,
    securityDeposit: l.security_deposit,
    maintenanceFee: l.maintenance_fee,
    condition: l.condition,
    visits: l.visits,
    visitsWeekly: l.visits_weekly,
    companyName: l.company_name,
    publishedAt: l.published_at,
    priceChangedAt: l.price_changed_at,
    imageUrl: l.image_url,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}
