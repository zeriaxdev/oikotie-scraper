import { paginateSearch } from "../scraper";
import { upsertListingsBatch } from "../db";
import type { SearchFilters } from "../scraper";
import { CARD_TYPE } from "../scraper";

export async function refreshTracked(): Promise<number> {
  const filters: SearchFilters = { cardType: CARD_TYPE.RENT };
  let count = 0;

  for await (const page of paginateSearch(filters)) {
    const result = upsertListingsBatch(page.listings);
    count += result.inserted + result.updated;
  }

  return count;
}
