import Link from "next/link";
import { searchDb, serializeListingRow, eur } from "@/lib/data";
import { SearchControls } from "@/components/search-controls";
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
            Filter every scraped listing, or jump straight to one by its Oikotie link.
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
          <p className="eyebrow mb-3">
            {total.toLocaleString("fi-FI")} listings · {offset + 1}–{Math.min(offset + rows.length, total)}
          </p>
          {rows.length === 0 ? (
            <p className="rule py-10 text-center text-sm text-muted-foreground">No listings match these filters.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="eyebrow rule border-b text-left [&>th]:pb-2 [&>th]:pr-4 [&>th]:font-semibold">
                  <th>Address</th>
                  <th className="hidden sm:table-cell">District</th>
                  <th className="text-right">Price</th>
                  <th className="hidden text-right sm:table-cell">Size</th>
                  <th className="text-right">€/m²</th>
                  <th className="hidden text-right md:table-cell">Rooms</th>
                  <th className="hidden text-right md:table-cell">Views/wk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id as number} className="rule border-b align-baseline transition-colors hover:bg-accent/60">
                    <td className="py-3 pr-4">
                      <Link href={`/listings/${l.id}`} className="font-medium hover:text-primary">
                        {(l.address as string) ?? "—"}
                      </Link>
                    </td>
                    <td className="hidden py-3 pr-4 text-sm text-muted-foreground sm:table-cell">
                      {(l.district as string) ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums">{eur(l.price as number)}</td>
                    <td className="hidden py-3 pr-4 text-right tabular-nums sm:table-cell">
                      {(l.sizeM2 as number) ?? "—"} m²
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                      {(l.pricePerM2 as number) ?? "—"}
                    </td>
                    <td className="hidden py-3 pr-4 text-right tabular-nums md:table-cell">
                      {(l.roomConfig as string) ?? (l.rooms as number) ?? "—"}
                    </td>
                    <td className="hidden py-3 text-right tabular-nums text-muted-foreground md:table-cell">
                      {(l.visitsWeekly as number) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="mt-5 flex gap-2">
            {offset > 0 && (
              <Link href={pageHref(Math.max(0, offset - limit))} className="border border-border px-4 py-1.5 text-sm hover:bg-accent">
                ← Prev
              </Link>
            )}
            {offset + rows.length < total && (
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
