// Detail backfill: fetches full /api/card/{id} "Perustiedot" for listings
// that don't have a detail row yet, and stores them.
//
//   bun run scrape:details                       # 500 most-viewed missing
//   bun run scrape:details --city=Helsinki
//   bun run scrape:details --type=rent --limit=2000
//
// getOrFetchDetail() is the lazy single-listing path used by the API.

import {
  getListingDetail,
  upsertListingDetail,
  getListingsMissingDetails,
} from "../db";
import { getCardDetail } from "./client";
import { config } from "../config";

/** Return the stored detail row, fetching and persisting it on first access. */
export async function getOrFetchDetail(id: number): Promise<Record<string, unknown> | null> {
  const existing = getListingDetail(id);
  if (existing) return existing;
  const detail = await getCardDetail(id);
  if (!detail) return null;
  upsertListingDetail(detail);
  return getListingDetail(id);
}

function parseFlag(args: string[], name: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function backfill() {
  const args = process.argv.slice(2);
  const city = parseFlag(args, "city");
  const typeArg = parseFlag(args, "type");
  const type = typeArg === "rent" || typeArg === "sale" ? typeArg : undefined;
  const limit = parseFlag(args, "limit") ? Number(parseFlag(args, "limit")) : 500;

  const ids = getListingsMissingDetails({ city, type, limit });
  console.log(
    `Backfilling details for ${ids.length} listings` +
      `${city ? ` in ${city}` : ""}${type ? ` (${type})` : ""}…`,
  );

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!;
    const detail = await getCardDetail(id);
    if (detail) {
      upsertListingDetail(detail);
      ok++;
    } else {
      failed++;
    }
    if ((i + 1) % 25 === 0 || i === ids.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${ids.length}  (${ok} ok, ${failed} failed)`);
    }
    await Bun.sleep(config.scraper.delayMs);
  }
  console.log(`\nDone. ${ok} details stored, ${failed} failed.`);
}

if (import.meta.main) {
  await backfill();
}
