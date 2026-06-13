import Link from "next/link";
import {
  allCitySummaries,
  cityMarket,
  findSmartDeals,
  attachLivability,
  serializeDeal,
  priceDistribution,
  eur,
} from "@/lib/data";
import { MarketControls } from "@/components/market-controls";
import { CityIndex } from "@/components/city-index";
import { DealLedger } from "@/components/deal-ledger";
import { Distribution } from "@/components/distribution";
import { Stagger, Item, FadeUp } from "@/components/motion";

export const dynamic = "force-dynamic";

type Search = { type?: string; city?: string; district?: string; flagged?: string; sort?: string };
type SortMode = "livability" | "value" | "cost";

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const type = sp.type === "sale" ? "sale" : "rent";
  const city = sp.city?.trim() || undefined;
  const district = sp.district?.trim() || undefined;
  const flagged = sp.flagged === "1";
  const sort: SortMode = sp.sort === "value" ? "value" : sp.sort === "cost" ? "cost" : "livability";

  const cities = allCitySummaries(type).filter((c) => c.count >= 20);
  const rawDeals = findSmartDeals(type, {
    city,
    district,
    minScore: flagged ? 0 : 40,
    limit: flagged ? 80 : 60,
    includeFlagged: flagged,
  });
  const enriched = await attachLivability(rawDeals);
  const sorted = [...enriched].sort((a, b) => {
    if (sort === "value") return b.dealScore - a.dealScore;
    if (sort === "cost") return a.trueCost - b.trueCost;
    return b.livability.score - a.livability.score;
  });
  const deals = sorted.slice(0, 30).map(serializeDeal);
  // How many below-model listings are hidden because they're flagged.
  const hiddenCount = flagged
    ? 0
    : findSmartDeals(type, { city, district, minScore: 0, limit: 2000, includeFlagged: true }).filter(
        (v) => v.disqualified,
      ).length;
  const market = city ? cityMarket(type, city) : null;
  const dist = city ? priceDistribution(type, city) : null;

  const dealsHref = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ type });
    if (city) q.set("city", city);
    if (district) q.set("district", district);
    if (sort !== "livability") q.set("sort", sort);
    if (flagged) q.set("flagged", "1");
    for (const [k, val] of Object.entries(extra)) q.set(k, val);
    return `/?${q}#deals`;
  };

  return (
    <main>
      {/* Blue hero panel */}
      <section className="panel">
        <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-20">
          <FadeUp>
            <p className="eyebrow text-primary-foreground/70">
              Market report — {type === "rent" ? "rentals" : "for sale"}
              {market ? ` · ${market.city}` : " · Finland"}
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h1 className="display mt-4 max-w-[16ch] text-[clamp(2.6rem,7vw,5.5rem)] leading-[0.95]">
              {market ? market.city : "What it should cost."}
            </h1>
          </FadeUp>

          {market && dist && (
            <Stagger className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4 lg:grid-cols-5" delay={0.15}>
              {[
                { label: "Median", value: eur(market.medianPrice) },
                { label: "Typical range", value: `${eur(market.p25Price)}–${eur(market.p75Price)}` },
                { label: "Per m²", value: `${market.medianPpm2.toFixed(1)} €` },
                { label: "Listings", value: market.count.toLocaleString("fi-FI") },
                ...(market.modelR2 != null
                  ? [{ label: "Model fit (R²)", value: market.modelR2.toFixed(2) }]
                  : []),
              ].map((s) => (
                <Item key={s.label}>
                  <div className="eyebrow text-primary-foreground/65">{s.label}</div>
                  <div className="figure mt-1.5 text-[clamp(1.4rem,2.6vw,2rem)]">{s.value}</div>
                </Item>
              ))}
            </Stagger>
          )}

          <FadeUp delay={market ? 0.3 : 0.12}>
            <div className="mt-12 border-t border-primary-foreground/20 pt-6">
              <MarketControls type={type} city={city} />
            </div>
          </FadeUp>
        </div>
      </section>

      {/* White data canvas */}
      <div className="graph">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
          {market && dist ? (
            <Stagger className="border-x border-border" delay={0.1}>
              <Item className="border-b border-border bg-background px-6 py-10 sm:px-10">
                <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.5fr_1fr]">
                  <div>
                    <p className="eyebrow mb-5">Rent distribution</p>
                    <Distribution bins={dist.bins} lo={dist.lo} hi={dist.hi} median={dist.median} />
                  </div>
                  <div className="lg:border-l lg:border-border lg:pl-10">
                    <p className="eyebrow mb-4">How the model reads {market.city}</p>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Prices regressed on size, rooms, age, floor and district. The district premiums
                      below isolate what location alone costs — everything else held equal.
                    </p>
                  </div>
                </div>
              </Item>

              {market.districts.length > 0 && (
                <Item className="bg-background px-6 py-10 sm:px-10">
                  <p className="eyebrow mb-5">
                    Districts · location premium over the city baseline · select to filter
                  </p>
                  <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
                    {market.districts.slice(0, 12).map((d) => {
                      const active = district?.toLowerCase() === d.district.toLowerCase();
                      const q = new URLSearchParams({ type, city: market.city });
                      if (!active) q.set("district", d.district);
                      return (
                        <Link
                          key={d.district}
                          href={`/?${q}#deals`}
                          scroll={false}
                          className={`group flex items-baseline justify-between border-b border-border py-3 transition-colors hover:text-primary ${
                            active ? "text-primary" : ""
                          }`}
                        >
                          <span className="text-[0.95rem]">
                            {d.district}
                            {active && <span className="ml-2 text-xs">— filtering ×</span>}
                          </span>
                          <span className="flex items-baseline gap-5 tabular-nums">
                            <span className="text-sm text-muted-foreground">{d.medianPpm2.toFixed(1)} €/m²</span>
                            {d.premium != null && (
                              <span
                                className="w-14 text-right text-sm font-medium"
                                style={{ color: d.premium > 0 ? "var(--bad)" : "var(--good)" }}
                              >
                                {d.premium > 0 ? "+" : ""}
                                {(d.premium * 100).toFixed(0)}%
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </Item>
              )}
            </Stagger>
          ) : (
            <Stagger className="border-x border-border bg-background" delay={0.1}>
              <Item className="max-w-2xl px-6 py-12 sm:px-10">
                <p className="text-[1.05rem] leading-relaxed text-muted-foreground">
                  Every listing is priced against a hedonic model fit per city — size, rooms, age,
                  floor, district. The gap between asking and estimate is the signal. Choose a city to
                  read its market, or scan the underpriced below.
                </p>
              </Item>
              <Item className="border-t border-border px-6 py-10 sm:px-10">
                <CityIndex cities={cities} type={type} active={city} />
              </Item>
            </Stagger>
          )}

          {/* Deals */}
          <section id="deals" className="scroll-mt-20 border-x border-b border-border bg-background px-6 py-12 sm:px-10">
            <FadeUp>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="display text-[clamp(1.8rem,3.5vw,2.6rem)]">
                  Below the model
                  {city && <span className="text-muted-foreground"> · {city}</span>}
                  {district && (
                    <Link href={dealsHref()} scroll={false} className="text-primary">
                      {" "}· {district} ×
                    </Link>
                  )}
                </h2>
                <div className="flex items-center gap-1 text-sm">
                  <span className="eyebrow mr-1">Rank by</span>
                  {(
                    [
                      ["livability", "Livability"],
                      ["cost", "True cost"],
                      ["value", "Value"],
                    ] as const
                  ).map(([key, label]) => (
                    <Link
                      key={key}
                      href={dealsHref({ sort: key })}
                      scroll={false}
                      className={`rounded-full px-2.5 py-1 transition-colors ${
                        sort === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Listed at least one robust standard deviation under the model&rsquo;s estimate for
                comparable apartments. Listings whose description reveals a renovation, sublet,
                shared/room rental or short-term lease are{" "}
                {flagged ? "shown in red and dimmed" : "filtered out"}.
              </p>
              {(hiddenCount > 0 || flagged) && (
                <Link
                  href={flagged ? dealsHref() : dealsHref({ flagged: "1" })}
                  scroll={false}
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                >
                  {flagged
                    ? "← Hide flagged listings"
                    : `Show ${hiddenCount} flagged listing${hiddenCount === 1 ? "" : "s"} →`}
                </Link>
              )}
            </FadeUp>
            <div className="mt-7">
              <DealLedger deals={deals} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
