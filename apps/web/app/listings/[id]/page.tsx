import Link from "next/link";
import {
  valuateListing,
  getCityModel,
  findComparables,
  getOrFetchDetail,
  serializeValuation,
  serializeDetailRow,
  eur,
} from "@/lib/data";
import { ValuationLede } from "@/components/valuation-lede";
import { Stagger, Item, FadeUp } from "@/components/motion";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const v = valuateListing(id);

  if (!v) {
    return (
      <main className="mx-auto max-w-6xl px-6 pt-10">
        <Link href="/" className="eyebrow hover:text-foreground">
          ← Market
        </Link>
        <h1 className="display mt-6 text-4xl">Listing {id}</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Can&rsquo;t value this one — it&rsquo;s missing a price or size, or its city has too little
          data to fit a model.
        </p>
      </main>
    );
  }

  const val = serializeValuation(v);
  const model = v.row.city ? getCityModel(v.row.type, v.row.city) : null;
  const comparables = model ? findComparables(model, v.row) : [];
  const detail = serializeDetailRow(await getOrFetchDetail(id));

  const yn = (b: unknown) => (b == null ? null : b ? "Yes" : "No");
  const rows: [string, string][] = [];
  const add = (k: string, x: unknown) => {
    if (x != null && x !== "") rows.push([k, String(x)]);
  };
  if (detail) {
    add("Availability", detail.availabilityInfo);
    add("Rent term", detail.rentTermInfo);
    add("Kitchen", detail.kitchenAppliances);
    add("Bathroom", detail.bathroomAppliances);
    add("Storage", detail.storageInfo);
    add("Balcony", detail.balconyInfo);
    add("Terrace", yn(detail.hasTerrace));
    add(
      "Sauna",
      detail.sauna != null ? yn(detail.sauna) + (detail.saunaInfo ? ` — ${detail.saunaInfo}` : "") : null,
    );
    add("Lift", yn(detail.lift));
    add("Heating", detail.heatingInfo);
    add("Energy class", detail.energyClass);
    add("Building floors", detail.buildingFloors);
    add("Water fee", detail.waterFeeInfo);
    add("Deposit", detail.securityDepositInfo);
    add("Other terms", detail.otherTerms);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 pt-8">
      <FadeUp>
        <Link href="/" className="eyebrow hover:text-foreground">
          ← Market
        </Link>
      </FadeUp>

      <Stagger className="mt-6" delay={0.1}>
        <Item>
          <p className="eyebrow">
            {[val.district, val.city, val.roomConfig, val.sizeM2 ? `${val.sizeM2} m²` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1 className="display mt-2 text-[clamp(2.2rem,6vw,4rem)] font-medium leading-[1.02]">
            <a href={val.url} target="_blank" rel="noreferrer" className="hover:text-primary">
              {val.address ?? `Listing ${id}`}
              <span className="ml-2 align-super text-xl text-muted-foreground">↗</span>
            </a>
          </h1>
        </Item>

        <Item className="mt-8">
          <ValuationLede v={val} />
        </Item>
      </Stagger>

      <div className="mt-16 grid grid-cols-1 gap-x-16 gap-y-12 lg:grid-cols-[1fr_1.1fr]">
        {rows.length > 0 && (
          <FadeUp>
            <h2 className="eyebrow mb-2">Particulars</h2>
            <dl>
              {rows.map(([k, x]) => (
                <div key={k} className="flex gap-6 rule py-2.5">
                  <dt className="w-36 shrink-0 text-sm text-muted-foreground">{k}</dt>
                  <dd className="text-sm">{x}</dd>
                </div>
              ))}
            </dl>
          </FadeUp>
        )}

        <div>
          {comparables.length > 0 && (
            <FadeUp>
              <h2 className="eyebrow mb-2">Closest comparables</h2>
              <table className="w-full border-collapse">
                <tbody>
                  {comparables.map((c) => (
                    <tr key={c.id} className="rule border-b align-baseline">
                      <td className="py-2.5 pr-4">
                        <Link href={`/listings/${c.id}`} className="font-serif hover:text-primary">
                          {c.address ?? "—"}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">{c.room_config}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-sm tabular-nums text-muted-foreground">
                        {c.size_m2} m²
                      </td>
                      <td className="py-2.5 text-right tabular-nums">{eur(c.price)}</td>
                      <td className="py-2.5 pl-4 text-right text-sm tabular-nums text-muted-foreground">
                        {(c.price / c.size_m2).toFixed(1)} €/m²
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FadeUp>
          )}

          {detail?.description ? (
            <FadeUp delay={0.05}>
              <h2 className="eyebrow mb-2 mt-10">From the listing</h2>
              <p className="max-w-prose whitespace-pre-wrap font-serif text-[0.95rem] leading-relaxed text-foreground/85">
                {String(detail.description)}
              </p>
            </FadeUp>
          ) : null}
        </div>
      </div>
    </main>
  );
}
