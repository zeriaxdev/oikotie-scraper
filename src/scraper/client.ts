import { config } from "../config";
import { RateLimiter } from "./rate-limit";
import type {
  OikotieSearchResponse,
  OikotieLocation,
  SearchFilters,
  Listing,
  LocationFilter,
} from "./types";
import { CARD_TYPE } from "./types";

const BASE_URL = "https://asunnot.oikotie.fi";
const limiter = new RateLimiter(3, 1);

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

// --- Token bootstrap (no login required) ---

type OtaTokens = {
  token: string;
  loaded: string;
  cuid: string;
};

let cachedTokens: OtaTokens | null = null;

async function fetchTokens(): Promise<OtaTokens> {
  const res = await fetch(`${BASE_URL}/vuokra-asunnot`, {
    headers: { "user-agent": randomUA() },
  });
  const html = await res.text();

  const token = html.match(/<meta\s+name="api-token"\s+content="([^"]+)"/)?.[1];
  const loaded = html.match(/<meta\s+name="loaded"\s+content="([^"]+)"/)?.[1];
  const cuid = html.match(/<meta\s+name="cuid"\s+content="([^"]+)"/)?.[1];

  if (!token || !loaded || !cuid) {
    throw new Error("Failed to extract OTA tokens from page");
  }

  return { token, loaded, cuid };
}

export async function getTokens(): Promise<OtaTokens> {
  if (!cachedTokens) {
    cachedTokens = await fetchTokens();
  }
  return cachedTokens;
}

export function invalidateTokens() {
  cachedTokens = null;
}

async function authHeaders(): Promise<Record<string, string>> {
  const tokens = await getTokens();
  return {
    accept: "application/json, text/plain, */*",
    "user-agent": randomUA(),
    "ota-token": tokens.token,
    "ota-loaded": tokens.loaded,
    "ota-cuid": tokens.cuid,
    referer: `${BASE_URL}/vuokra-asunnot`,
  };
}

// --- API methods ---

function buildSearchParams(filters: SearchFilters, offset: number, limit: number): URLSearchParams {
  const params = new URLSearchParams();

  params.set("cardType", String(filters.cardType ?? CARD_TYPE.RENT));
  params.set("secondarySearchType", "1");
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  if (filters.locations?.length) {
    const encoded = filters.locations.map(
      (l) => `[${l.cardId},${l.cardType},${JSON.stringify(l.name)}]`,
    );
    params.set("locations", `[${encoded.join(",")}]`);
  }

  if (filters.roomCount?.length) {
    for (const r of filters.roomCount) {
      params.append("roomCount[]", String(r));
    }
  }

  if (filters.priceMin != null) params.set("price[min]", String(filters.priceMin));
  if (filters.priceMax != null) params.set("price[max]", String(filters.priceMax));
  if (filters.sizeMin != null) params.set("size[min]", String(filters.sizeMin));
  if (filters.sizeMax != null) params.set("size[max]", String(filters.sizeMax));

  return params;
}

async function apiFetch(url: string): Promise<Response> {
  const headers = await authHeaders();
  const res = await fetch(url, { headers });

  if (res.status === 401 || res.status === 403) {
    invalidateTokens();
    const freshHeaders = await authHeaders();
    const retry = await fetch(url, { headers: freshHeaders });
    if (!retry.ok) throw new Error(`API request failed after token refresh: ${retry.status}`);
    return retry;
  }

  if (!res.ok) throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  return res;
}

export async function searchListings(
  filters: SearchFilters,
  offset = 0,
  limit = 24,
): Promise<{ total: number; cards: OikotieSearchResponse["secondaryCards"]; rawJson: string }> {
  await limiter.acquire();

  const params = buildSearchParams(filters, offset, limit);
  const url = `${BASE_URL}/api/search?${params}`;
  const res = await apiFetch(url);
  const rawJson = await res.text();
  const data = JSON.parse(rawJson) as OikotieSearchResponse;

  const cards = data.cards.length > 0 ? data.cards : data.secondaryCards;
  return { total: data.found, cards, rawJson };
}

export async function getSearchCount(filters: SearchFilters): Promise<number> {
  const { total } = await searchListings(filters, 0, 0);
  return total;
}

export async function searchLocations(query: string): Promise<OikotieLocation[]> {
  await limiter.acquire();

  const url = `${BASE_URL}/api/3.0/location?query=${encodeURIComponent(query)}`;
  const res = await apiFetch(url);
  return (await res.json()) as OikotieLocation[];
}

export function resolveLocation(loc: OikotieLocation): LocationFilter {
  return {
    cardId: loc.card.cardId,
    cardType: loc.card.cardType,
    name: loc.card.name,
  };
}

// --- Detail endpoints ---

export type AreaProfile = {
  transportation?: { name: string; content: AreaItem[] };
  family?: { name: string; content: AreaItem[] };
  services?: { name: string; content: AreaItem[] };
  healthcare?: { name: string; content: AreaItem[] };
  activities?: { name: string; content: AreaItem[] };
  demography?: {
    name: string;
    children?: { name: string; percentage: number };
    adults?: { name: string; percentage: number };
    seniors?: { name: string; percentage: number };
    families?: { name: string; percentage: number };
  };
};

export type AreaItem = {
  type: string;
  name: string;
  travelTime: string;
  distance: string;
  description: string;
};

export async function getAreaProfile(cardId: number): Promise<AreaProfile | null> {
  await limiter.acquire();
  try {
    const res = await apiFetch(`${BASE_URL}/api/latest/areaprofile/${cardId}`);
    return (await res.json()) as AreaProfile;
  } catch {
    return null;
  }
}

export async function getRecommendations(cardId: number): Promise<OikotieSearchResponse["secondaryCards"]> {
  await limiter.acquire();
  try {
    const res = await apiFetch(`${BASE_URL}/api/2.0/recommendations/${cardId}`);
    return (await res.json()) as OikotieSearchResponse["secondaryCards"];
  } catch {
    return [];
  }
}

// --- Data parsing ---

export function parsePrice(priceStr: string): number | null {
  const cleaned = priceStr.replace(/[^\d.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function cardToListing(card: OikotieSearchResponse["secondaryCards"][number]): Listing {
  const isRent = card.cardType === CARD_TYPE.RENT;
  return {
    id: card.cardId,
    url: card.url ?? "",
    type: isRent ? "rent" : "sale",
    price: card.data?.price ? parsePrice(card.data.price) : null,
    priceStr: card.data?.price ?? "",
    rooms: card.data?.rooms ?? null,
    roomConfig: card.data?.roomConfiguration ?? null,
    sizeM2: card.data?.sizeMin ?? null,
    buildYear: card.data?.buildYear ?? null,
    floor: card.data?.floor ?? null,
    totalFloors: card.data?.buildingFloorCount ?? null,
    address: card.location?.address ?? null,
    district: card.location?.district ?? null,
    city: card.location?.city ?? null,
    zipCode: card.location?.zipCode ?? null,
    lat: card.location?.latitude ?? null,
    lng: card.location?.longitude ?? null,
    description: card.data?.description ?? null,
    securityDeposit: card.data?.securityDeposit ?? null,
    maintenanceFee: card.data?.maintenanceFee ?? null,
    condition: card.data?.condition ?? null,
    visits: card.data?.visits ?? 0,
    visitsWeekly: card.data?.visitsWeekly ?? 0,
    companyName: card.company?.companyName ?? null,
    publishedAt: card.meta?.published ?? null,
    priceChangedAt: card.meta?.priceChanged ?? null,
    imageUrl: card.medias?.[0]?.imageLargeJPEG ?? null,
  };
}

export async function* paginateSearch(
  filters: SearchFilters,
  pageSize = config.scraper.pageSize,
): AsyncGenerator<{ listings: Listing[]; total: number; offset: number; rawJson: string }> {
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const result = await searchListings(filters, offset, pageSize);
    total = result.total;

    const listings = result.cards.map(cardToListing);
    yield { listings, total, offset, rawJson: result.rawJson };

    offset += pageSize;

    if (result.cards.length === 0) break;

    await Bun.sleep(config.scraper.delayMs);
  }
}
