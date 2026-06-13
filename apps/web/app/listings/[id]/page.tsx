import Link from "next/link";
import {
  valuateListing,
  getCityModel,
  findComparables,
  getOrFetchDetail,
  getCostInputs,
  getAreaProfile,
  serializeValuation,
  serializeDetailRow,
  eur,
} from "@/lib/data";
import { ValuationLede } from "@/components/valuation-lede";
import { CostPanel } from "@/components/cost-panel";
import { Stagger, Item, FadeUp } from "@/components/motion";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const v = valuateListing(id);

  if (!v) {
    return (
      <main className="graph">
        <div className="mx-auto max-w-[1400px] border-x border-border bg-background px-6 py-16 sm:px-10">
          <Link href="/" className="eyebrow hover:text-foreground">← Market</Link>
          <h1 className="display mt-6 text-4xl">Listing {id}</h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Can&rsquo;t value this one — missing a price or size, or its city has too little data.
          </p>
        </div>
      </main>
    );
  }

  const val = serializeValuation(v);
  const model = v.row.city ? getCityModel(v.row.type, v.row.city) : null;
  const comparables = model ? findComparables(model, v.row) : [];
  const detailRow = await getOrFetchDetail(id);
  const detail = serializeDetailRow(detailRow);
  const heating = String((detailRow as Record<string, unknown>)?.heating_info ?? "").toLowerCase();

  const [costInputs, area] = await Promise.all([
    getCostInputs({
      id,
      rent: v.row.price,
      maintenanceFee: (detailRow as Record<string, unknown>)?.maintenance_fee as number ?? null,
      waterPerPerson: ((detailRow as Record<string, unknown>)?.water_fee as number) ?? null,
      sizeM2: v.row.size_m2,
      electricHeating: heating.includes("sähkö"),
    }),
    getAreaProfile(id),
  ]);

  const yn = (b: unknown) => (b == null ? null : b ? "Yes" : "No");
  const particulars: [string, string][] = [];
  const add = (k: string, x: unknown) => {
    if (x != null && x !== "") particulars.push([k, String(x)]);
  };
  if (detail) {
    add("Availability", detail.availabilityInfo);
    add("Rent term", detail.rentTermInfo);
    add("Kitchen", detail.kitchenAppliances);
    add("Bathroom", detail.bathroomAppliances);
    add("Storage", detail.storageInfo);
    add("Balcony", detail.balconyInfo);
    add("Terrace", yn(detail.hasTerrace));
    add("Sauna", detail.sauna != null ? yn(detail.sauna) + (detail.saunaInfo ? ` — ${detail.saunaInfo}` : "") : null);
    add("Lift", yn(detail.lift));
    add("Energy class", detail.energyClass);
    add("Building floors", detail.buildingFloors);
    add("Other terms", detail.otherTerms);
  }

  const transit = area?.transportation?.content?.slice(0, 6) ?? [];
  const services = area?.services?.content?.slice(0, 4) ?? [];

  return (
    <main className="graph">
      <div className="mx-auto max-w-[1400px]">
        <Stagger className="border-x border-b border-border bg-background px-6 py-10 sm:px-10" delay={0.05}>
          <Item>
            <Link href="/" className="eyebrow hover:text-foreground">← Market</Link>
            <p className="eyebrow mt-5">
              {[val.district, val.city, val.roomConfig, val.sizeM2 ? `${val.sizeM2} m²` : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="display mt-2 text-[clamp(2rem,5.5vw,3.6rem)] leading-[0.98]">
              <a href={val.url} target="_blank" rel="noreferrer" className="hover:text-primary">
                {val.address ?? `Listing ${id}`}
                <span className="ml-2 align-super text-lg text-muted-foreground">↗</span>
              </a>
            </h1>
          </Item>
          <Item className="mt-8">
            <ValuationLede v={val} />
          </Item>
        </Stagger>

        {/* True monthly cost — featured */}
        {costInputs.rent != null && (
          <FadeUp className="border-x border-b border-border bg-background px-6 py-9 sm:px-10">
            <CostPanel inputs={costInputs} />
          </FadeUp>
        )}

        {/* Particulars · Transport */}
        <div className="grid grid-cols-1 border-x border-b border-border bg-background lg:grid-cols-2">
          {particulars.length > 0 && (
            <FadeUp className="px-6 py-9 sm:px-10 lg:border-r lg:border-border">
              <h2 className="eyebrow mb-4">Particulars</h2>
              <dl>
                {particulars.map(([k, x]) => (
                  <div key={k} className="flex gap-6 border-b border-border py-2.5">
                    <dt className="w-36 shrink-0 text-sm text-muted-foreground">{k}</dt>
                    <dd className="text-sm">{x}</dd>
                  </div>
                ))}
              </dl>
            </FadeUp>
          )}

          <FadeUp className="px-6 py-9 sm:px-10">
            {transit.length > 0 ? (
              <>
                <h2 className="eyebrow mb-4">Transport</h2>
                <dl>
                  {transit.map((t, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
                      <dt className="text-sm">{t.name}</dt>
                      <dd className="shrink-0 text-sm tabular-nums text-muted-foreground">{t.travelTime}</dd>
                    </div>
                  ))}
                </dl>
                {services.length > 0 && (
                  <>
                    <h2 className="eyebrow mb-4 mt-7">Nearby</h2>
                    <dl>
                      {services.map((s, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
                          <dt className="text-sm">{s.name}</dt>
                          <dd className="shrink-0 text-sm tabular-nums text-muted-foreground">{s.travelTime}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Transport data unavailable for this listing.</p>
            )}
          </FadeUp>
        </div>

        {/* Comparables · Description */}
        <div className="grid grid-cols-1 border-x border-b border-border bg-background lg:grid-cols-2">
          <FadeUp className="px-6 py-9 sm:px-10 lg:border-r lg:border-border">
            <h2 className="eyebrow mb-4">Closest comparables</h2>
            {comparables.length > 0 ? (
              <table className="w-full border-collapse">
                <tbody>
                  {comparables.map((c) => (
                    <tr key={c.id} className="border-b border-border align-baseline">
                      <td className="py-2.5 pr-4">
                        <Link href={`/listings/${c.id}`} className="font-medium hover:text-primary">
                          {c.address ?? "—"}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">{c.room_config}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-sm tabular-nums text-muted-foreground">{c.size_m2} m²</td>
                      <td className="py-2.5 text-right tabular-nums">{eur(c.price)}</td>
                      <td className="py-2.5 pl-4 text-right text-sm tabular-nums text-muted-foreground">
                        {(c.price / c.size_m2).toFixed(1)} €/m²
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">No comparables in this district.</p>
            )}
          </FadeUp>

          {detail?.description ? (
            <FadeUp className="px-6 py-9 sm:px-10">
              <h2 className="eyebrow mb-4">From the listing</h2>
              <p className="max-w-prose whitespace-pre-wrap text-[0.95rem] leading-relaxed text-foreground/85">
                {String(detail.description)}
              </p>
            </FadeUp>
          ) : (
            <div className="px-6 py-9" />
          )}
        </div>
      </div>
    </main>
  );
}
