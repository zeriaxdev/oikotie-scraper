import {
  allCitySummaries,
  cityMarket,
  findSmartDeals,
  serializeValuation,
  priceDistribution,
  eur,
} from "@/lib/data";
import { MarketControls } from "@/components/market-controls";
import { CityIndex } from "@/components/city-index";
import { DealLedger } from "@/components/deal-ledger";
import { Distribution } from "@/components/distribution";
import { Stagger, Item, FadeUp } from "@/components/motion";

export const dynamic = "force-dynamic";

type Search = { type?: string; city?: string };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rule pt-2">
      <dt className="eyebrow">{label}</dt>
      <dd className="display mt-1 text-2xl tabular-nums">{value}</dd>
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const type = sp.type === "sale" ? "sale" : "rent";
  const city = sp.city?.trim() || undefined;

  const cities = allCitySummaries(type).filter((c) => c.count >= 20);
  const deals = findSmartDeals(type, { city, minScore: 40, limit: 30 }).map(serializeValuation);
  const market = city ? cityMarket(type, city) : null;
  const dist = city ? priceDistribution(type, city) : null;

  return (
    <main className="mx-auto max-w-6xl px-6 pt-8">
      <FadeUp delay={0.2}>
        <MarketControls type={type} city={city} />
      </FadeUp>

      {market && dist ? (
        <Stagger className="mt-10" delay={0.3}>
          <Item>
            <p className="eyebrow">Market report · {type}</p>
            <h2 className="display mt-1 text-[clamp(2.5rem,7vw,5rem)] font-medium">{market.city}</h2>
          </Item>

          <Item className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr]">
            <div className="pt-4">
              <Distribution bins={dist.bins} lo={dist.lo} hi={dist.hi} median={dist.median} />
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
              <Stat label="Median" value={eur(market.medianPrice)} />
              <Stat label="Typical range" value={`${eur(market.p25Price)}–${eur(market.p75Price)}`} />
              <Stat label="Per m²" value={`${market.medianPpm2.toFixed(1)} €`} />
              <Stat label="Listings" value={market.count.toLocaleString("fi-FI")} />
              {market.modelR2 != null && (
                <Stat label="Model fit (R²)" value={market.modelR2.toFixed(2)} />
              )}
            </dl>
          </Item>

          {market.districts.length > 0 && (
            <Item className="mt-12">
              <p className="eyebrow mb-3">Districts · location premium over the city baseline</p>
              <div className="grid grid-cols-1 gap-x-12 sm:grid-cols-2">
                {market.districts.slice(0, 8).map((d) => (
                  <div key={d.district} className="flex items-baseline justify-between rule py-2.5">
                    <span className="font-serif text-base">{d.district}</span>
                    <span className="flex items-baseline gap-4 tabular-nums">
                      <span className="text-sm text-muted-foreground">{d.medianPpm2.toFixed(1)} €/m²</span>
                      {d.premium != null && (
                        <span
                          className="w-16 text-right text-sm font-medium"
                          style={{ color: d.premium > 0 ? "var(--bad)" : "var(--good)" }}
                        >
                          {d.premium > 0 ? "+" : ""}
                          {(d.premium * 100).toFixed(0)}%
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Item>
          )}
        </Stagger>
      ) : (
        <Stagger className="mt-10" delay={0.3}>
          <Item className="max-w-2xl">
            <p className="eyebrow">Market report</p>
            <h2 className="display mt-2 text-[clamp(2rem,5vw,3.5rem)] font-medium leading-[1.02]">
              What an apartment <em className="italic">should</em> cost — and which ones don&rsquo;t.
            </h2>
            <p className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground">
              Every listing is priced against a hedonic model fit per city — size, rooms, age, floor
              and district. The gap between asking and estimate is the signal. Pick a city to read its
              market, or scan the underpriced below.
            </p>
          </Item>
          <Item className="mt-10">
            <CityIndex cities={cities} type={type} active={city} />
          </Item>
        </Stagger>
      )}

      <section className="mt-16">
        <FadeUp>
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="display text-2xl">Below the model{city ? ` · ${city}` : ""}</h3>
            <p className="eyebrow hidden sm:block">{deals.length} listings · ranked by deal score</p>
          </div>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Listed at least one robust standard deviation under the model&rsquo;s estimate.
          </p>
        </FadeUp>
        <div className="mt-5">
          <DealLedger deals={deals} />
        </div>
      </section>
    </main>
  );
}
