import { paginateSearch, searchLocations, resolveLocation, getTokens } from "./client";
import { upsertListingsBatch, startScrapeRun, finishScrapeRun, saveRawResponse, getStats } from "../db";
import type { SearchFilters, LocationFilter } from "./types";
import { CARD_TYPE } from "./types";

const ALL_CITIES = [
  "Helsinki", "Espoo", "Vantaa", "Tampere", "Turku",
  "Oulu", "Jyväskylä", "Lahti", "Kuopio", "Pori",
  "Kouvola", "Joensuu", "Lappeenranta", "Hämeenlinna",
  "Vaasa", "Seinäjoki", "Rovaniemi", "Kotka", "Mikkeli",
];

async function resolveCity(name: string): Promise<LocationFilter | null> {
  const results = await searchLocations(name);
  const city = results.find(
    (r) => r.card.cardType === 6 && r.card.name.toLowerCase() === name.toLowerCase(),
  );
  if (city) {
    console.log(`  resolved: ${name} → cardId ${city.card.cardId}`);
    return resolveLocation(city);
  }
  console.warn(`  warning: could not resolve city "${name}"`);
  return null;
}

async function pickCities(): Promise<string[]> {
  console.log("\nAvailable cities:");
  ALL_CITIES.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
  console.log(`  a. All cities`);

  process.stdout.write("\nSelect cities (comma-separated numbers, or 'a' for all): ");

  for await (const line of console) {
    const input = line.trim().toLowerCase();
    if (input === "a") return [...ALL_CITIES];

    const indices = input.split(",").map((s) => parseInt(s.trim(), 10) - 1);
    const selected = indices
      .filter((i) => i >= 0 && i < ALL_CITIES.length)
      .map((i) => ALL_CITIES[i]!);

    if (selected.length > 0) return selected;

    process.stdout.write("Invalid selection. Try again: ");
  }

  return [];
}

async function crawlCity(cityLocation: LocationFilter, type: "rent" | "sale") {
  const cardType = type === "rent" ? CARD_TYPE.RENT : CARD_TYPE.SALE;
  const filters: SearchFilters = { locations: [cityLocation], cardType };

  const runId = startScrapeRun(`${type}:${cityLocation.name}`, filters);
  let totalUpserted = 0;
  let totalErrors = 0;
  let totalFound = 0;

  console.log(`\n--- ${cityLocation.name} (${type}) ---`);

  try {
    for await (const page of paginateSearch(filters)) {
      totalFound = page.total;

      saveRawResponse(
        runId,
        `search?city=${cityLocation.name}&offset=${page.offset}&cardType=${cardType}`,
        page.rawJson,
      );

      try {
        const result = upsertListingsBatch(page.listings);
        totalUpserted += page.listings.length;
        totalErrors += result.errors;
        const pct = Math.min(100, Math.round(((page.offset + page.listings.length) / page.total) * 100));
        console.log(
          `  [${pct}%] ${page.listings.length} listings (${result.inserted} new) — ${page.offset + page.listings.length}/${page.total}`,
        );
      } catch (err) {
        totalErrors++;
        console.error(`  error at offset ${page.offset}:`, err);
      }
    }
  } catch (err) {
    totalErrors++;
    console.error(`  fatal error crawling ${cityLocation.name}:`, err);
  }

  finishScrapeRun(runId, totalFound, totalUpserted, totalErrors);
  console.log(`  ${cityLocation.name}: ${totalUpserted} upserted, ${totalErrors} errors`);
}

async function main() {
  const args = process.argv.slice(2);
  const typesArg = args.find((a) => a.startsWith("--type="))?.split("=")[1];
  const citiesArg = args.find((a) => a.startsWith("--cities="))?.split("=")[1];
  const allCities = args.includes("--all");
  const pick = args.includes("--pick");
  const statsOnly = args.includes("--stats");

  if (statsOnly) {
    const stats = getStats();
    console.log("\n=== Database Stats ===");
    console.log(`Total listings: ${stats.total} (rent: ${stats.rent}, sale: ${stats.sale})`);
    console.log("Cities:", stats.cities.map((c) => `${c.city}: ${c.count}`).join(", "));
    if (stats.lastRun) console.log("Last run:", stats.lastRun);
    return;
  }

  const types: ("rent" | "sale")[] = typesArg
    ? (typesArg.split(",") as ("rent" | "sale")[])
    : ["rent"];

  let cityNames: string[];
  if (pick) {
    cityNames = await pickCities();
  } else if (allCities) {
    cityNames = [...ALL_CITIES];
  } else if (citiesArg) {
    cityNames = citiesArg.split(",");
  } else {
    cityNames = await pickCities();
  }

  if (cityNames.length === 0) {
    console.log("No cities selected.");
    return;
  }

  console.log("\n=== Oikotie Crawler ===");
  console.log(`Types: ${types.join(", ")}`);
  console.log(`Cities: ${cityNames.join(", ")}`);

  console.log("\nBootstrapping API tokens...");
  const tokens = await getTokens();
  console.log(`  cuid: ${tokens.cuid.slice(0, 8)}...`);
  console.log(`  token: ${tokens.token.slice(0, 8)}...`);

  const started = Date.now();

  for (const cityName of cityNames) {
    console.log(`\nResolving ${cityName}...`);
    const location = await resolveCity(cityName);
    if (!location) continue;

    for (const type of types) {
      await crawlCity(location, type);
    }

    await Bun.sleep(1000);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n=== Finished in ${elapsed}s ===`);

  const stats = getStats();
  console.log(`Database: ${stats.total} listings (rent: ${stats.rent}, sale: ${stats.sale})`);
}

main().catch((err) => {
  console.error("Crawler failed:", err);
  process.exit(1);
});
