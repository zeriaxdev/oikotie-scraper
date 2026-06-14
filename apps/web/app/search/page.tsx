import Link from "next/link";
import { searchDb, serializeListingRow, valuateListing, attachLivability } from "@/lib/data";
import { SearchControls } from "@/components/search-controls";
import { SearchResults, type SearchItem } from "@/components/search-results";
import { FadeUp } from "@/components/motion";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = {
  price: "price ASC",
  "-price": "price DESC",
  size: "size_m2 ASC",
  "-size": "size_m2 DESC",
  newest: "published_at DESC",
  popular: "visits_weekly DESC",
};

type Search = {
  type?: string; city?: string; district?: string;
  minPrice?: string; maxPrice?: string; minSize?: string; maxSize?: string;
  rooms?: string; sort?: string; offset?: string;
};

const n = (s?: string) => (s && s.trim() ? Number(s) : undefined);

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const type = sp.type === "sale" ? "sale" : "rent";
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "price";
  const offset = n(sp.offset) ?? 0;
  const limit = 40;

  const { listings, total } = searchDb({
    type,
    city: sp.city?.trim() || undefined,
    district: sp.district?.trim() || undefined,
    minPrice: n(sp.minPrice),
    maxPrice: n(sp.maxPrice),
    minSize: n(sp.minSize),
    maxSize: n(sp.maxSize),
    rooms: n(sp.rooms),
    limit,
    offset,
    orderBy: SORTS[sort],
  });
  const rows = (listings as Record<string, unknown>[]).map(serializeListingRow);

  // Enrich with valuation + livability + true cost for each result.
  const valuations = rows
    .map((r) => valuateListing(r.id as number))
    .filter((v): v is NonNullable<typeof v> => v != null);
  const enriched = await attachLivability(valuations);
  const byId = new Map(enriched.map((e) => [e.row.id, e]));

  const items: SearchItem[] = rows.map((r) => {
    const e = byId.get(r.id as number);
    return {
      id: r.id as number,
      imageUrl: (r.imageUrl as string) ?? null,
      address: (r.address as string) ?? null,
      district: (r.district as string) ?? null,
      city: (r.city as string) ?? null,
      price: (r.price as number) ?? null,
      sizeM2: (r.sizeM2 as number) ?? null,
      pricePerM2: (r.pricePerM2 as number) ?? null,
      roomConfig: (r.roomConfig as string) ?? null,
      rooms: (r.rooms as number) ?? null,
      visitsWeekly: (r.visitsWeekly as number) ?? null,
      livability: e ? e.livability.score : null,
      edgePercent: e ? Math.round(e.edge * 1000) / 10 : null,
      trueCost: e ? e.trueCost : null,
      flags: e ? e.flags : [],
      disqualified: e ? e.disqualified : false,
    };
  });

  const pageHref = (o: number) => {
    const q = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) if (val && k !== "offset") q.set(k, String(val));
    q.set("offset", String(o));
    return `/search?${q}`;
  };

  return (
    <main className="graph">
      <div className="mx-auto max-w-[1400px] border-x border-b border-border bg-background px-6 py-9 sm:px-10">
        <FadeUp>
          <h1 className="display text-[clamp(1.8rem,4vw,3rem)]">Search the market</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Filter every listing — with value, true cost and livability inline — or jump straight to
            one by its Oikotie link.
          </p>
          <div className="mt-6">
            <SearchControls
              initial={{
                type,
                city: sp.city ?? "",
                district: sp.district ?? "",
                minPrice: sp.minPrice ?? "",
                maxPrice: sp.maxPrice ?? "",
                minSize: sp.minSize ?? "",
                maxSize: sp.maxSize ?? "",
                rooms: sp.rooms ?? "",
                sort,
              }}
            />
          </div>
        </FadeUp>

        <FadeUp delay={0.05} className="mt-8">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="eyebrow">
              {total.toLocaleString("fi-FI")} listings · {total === 0 ? 0 : offset + 1}–
              {Math.min(offset + items.length, total)}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              true/mo = rent + water + electricity + insurance · edge vs model · livability 0–100
            </p>
          </div>

          <SearchResults items={items} />

          <div className="mt-5 flex gap-2">
            {offset > 0 && (
              <Link href={pageHref(Math.max(0, offset - limit))} className="border border-border px-4 py-1.5 text-sm hover:bg-accent">
                ← Prev
              </Link>
            )}
            {offset + items.length < total && (
              <Link href={pageHref(offset + limit)} className="border border-border px-4 py-1.5 text-sm hover:bg-accent">
                Next →
              </Link>
            )}
          </div>
        </FadeUp>
      </div>
    </main>
  );
}
