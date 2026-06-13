// --- API response shapes (what Oikotie returns) ---

export type OikotieSearchResponse = {
  found: number;
  start: number;
  cards: OikotieCard[];
  secondaryCards: OikotieCard[];
};

export type OikotieCard = {
  cardId: number;
  cardType: number;
  cardSubType: number;
  url: string;
  status: number;
  data: {
    description: string;
    rooms: number;
    roomConfiguration: string;
    price: string;
    size: string;
    buildYear: number | null;
    sizeLot: string | null;
    sizeMin: number | null;
    sizeMax: number | null;
    nextViewing: {
      date: string;
      start: string;
      end: string;
      live: boolean;
      first: boolean;
    } | null;
    newDevelopment: boolean;
    isOnlineOffer: boolean;
    extraVisibility: boolean;
    visits: number;
    visitsWeekly: number;
    securityDeposit: number | null;
    maintenanceFee: number | null;
    floor: number | null;
    buildingFloorCount: number | null;
    pricePerSqm: number | null;
    condition: string | null;
    sourceType: number;
  };
  location: {
    address: string;
    district: string;
    city: string;
    zipCode: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  meta: {
    published: string;
    contractType: number;
    listingType: number;
    cardViewType: number;
    listingTypes: number[];
    sellStatus: string | null;
    priceChanged: string | null;
    vendorAdId: string;
    vendorCompanyId: string;
    senderNode: string;
    publishedSort: string;
  };
  medias: OikotieMedia[];
  company: {
    companyId: number;
    companyName: string;
    companyBrandHighlightBackgroundColor: string | null;
    companyBrandHighlightFontColor: string | null;
    searchLogo: string | null;
    logo: string | null;
    realtorImage: string | null;
    realtorName: string | null;
  };
  recommendationId: string | null;
};

export type OikotieMedia = {
  imageSmallJPEG: string;
  imageLargeJPEG: string;
  imageDesktopWebP: string;
  imageDesktopWebPx2: string;
  imageTabletWebP: string;
  imageTabletWebPx2: string;
  imageMobileWebP: string;
  imageMobileWebPx2: string;
  imageMobileSmallWebP: string;
  imageMobileSmallWebPx2: string;
};

export type OikotieLocation = {
  card: {
    name: string;
    cardId: number;
    cardType: number;
    coordinates: {
      cardId: number;
      latitude: number;
      longitude: number;
    } | null;
  };
  parent: {
    name: string;
    cardId: number;
    cardType: number;
    coordinates: null;
  };
};

// --- Normalized domain types (what we store) ---

export type Listing = {
  id: number;
  url: string;
  type: "rent" | "sale";
  price: number | null;
  priceStr: string | null;
  rooms: number | null;
  roomConfig: string | null;
  sizeM2: number | null;
  buildYear: number | null;
  floor: number | null;
  totalFloors: number | null;
  address: string | null;
  district: string | null;
  city: string | null;
  zipCode: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  securityDeposit: number | null;
  maintenanceFee: number | null;
  condition: string | null;
  visits: number;
  visitsWeekly: number;
  companyName: string | null;
  publishedAt: string | null;
  priceChangedAt: string | null;
  imageUrl: string | null;
};

// Full per-listing detail from /api/card/{id} ("Perustiedot").
// Curated, human-readable fields; the complete payload is kept in rawJson.
export type ListingDetail = {
  listingId: number;
  title: string | null;
  description: string | null;
  availabilityInfo: string | null;
  availabilityDate: string | null;
  rentTermInfo: string | null;
  kitchenAppliances: string | null;
  bathroomAppliances: string | null;
  storageInfo: string | null;
  balconyInfo: string | null;
  hasTerrace: boolean | null;
  sauna: boolean | null;
  saunaInfo: string | null;
  lift: boolean | null;
  heatingInfo: string | null;
  waterFee: number | null;
  waterFeeInfo: string | null;
  securityDepositInfo: string | null;
  otherTerms: string | null;
  petsAllowedCode: number | null;
  conditionCode: number | null;
  energyClass: string | null;
  buildingTypeCode: number | null;
  buildingFloors: number | null;
  rawJson: string;
};

export type PriceSnapshot = {
  listingId: number;
  price: number;
  scrapedAt: string;
};

export type SearchFilters = {
  locations?: LocationFilter[];
  cardType?: number;
  roomCount?: number[];
  priceMin?: number;
  priceMax?: number;
  sizeMin?: number;
  sizeMax?: number;
};

export type LocationFilter = {
  cardId: number;
  cardType: number;
  name: string;
};

// cardType constants
export const CARD_TYPE = {
  RENT: 101,
  SALE: 100,
} as const;

// location cardType constants
export const LOCATION_TYPE = {
  NEIGHBORHOOD: 3,
  DISTRICT: 4,
  CITY: 6,
  REGION: 7,
} as const;
