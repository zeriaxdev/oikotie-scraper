import { allCitySummaries, findSmartDeals, serializeValuation, eur, pct } from "@/lib/data";

export const dynamic = "force-dynamic";

type Search = { type?: string; city?: string };

function edgeClass(z: number) {
  return z <= -1 ? "pos" : z >= 1 ? "neg" : "neu";
}

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const type = sp.type === "sale" ? "sale" : "rent";
  const city = sp.city?.trim() || undefined;

  const cities = allCitySummaries(type).filter((c) => c.count >= 20);
  const deals = findSmartDeals(type, { city, minScore: 40, limit: 25 }).map(serializeValuation);

  const link = (t: string, c?: string) =>
    `/?type=${t}${c ? `&city=${encodeURIComponent(c)}` : ""}`;

  return (
    <main className="wrap">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <h1 style={{ margin: 0 }}>Market</h1>
        <div className="grow" />
        <div className="seg">
          <a href={link("rent", city)} className={type === "rent" ? "on" : ""}>Rent</a>
          <a href={link("sale", city)} className={type === "sale" ? "on" : ""}>Sale</a>
        </div>
      </div>

      <h2>Cities</h2>
      <div className="cards">
        {cities.map((c) => (
          <a key={c.city} className="card" href={link(type, c.city)}>
            <h3>{c.city}</h3>
            <div className="big num">{eur(c.medianPrice)}</div>
            <div className="sub num">median · {c.medianPpm2.toFixed(1)} €/m²</div>
            <div>
              <span className="chip num">{c.count.toLocaleString("fi-FI")} listings</span>
              {c.modelR2 != null && <span className="chip num"> R² {c.modelR2.toFixed(2)}</span>}
            </div>
          </a>
        ))}
      </div>

      <h2>Deals {city ? `· ${city}` : ""}</h2>
      <form className="filters" method="get">
        <input type="hidden" name="type" value={type} />
        <div className="field">
          <label>Filter by city</label>
          <input name="city" defaultValue={city ?? ""} placeholder="Helsinki" />
        </div>
        <button className="btn" type="submit">Apply</button>
        {city && <a className="back" href={link(type)} style={{ paddingBottom: 9 }}>clear</a>}
      </form>
      <p className="meta">
        {deals.length} listings priced below the hedonic-model estimate, ranked by deal score.
      </p>
      <table>
        <thead>
          <tr>
            <th className="r">Score</th>
            <th>Address</th>
            <th>District</th>
            <th className="r">Asking</th>
            <th className="r">Estimate</th>
            <th className="r">Edge</th>
            <th className="r">z</th>
            <th>Conf</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d) => (
            <tr key={d.id}>
              <td className="r score pos num">{d.dealScore}</td>
              <td><a href={`/listings/${d.id}`} style={{ color: "var(--blue)" }}>{d.address ?? "—"}</a></td>
              <td>{d.district ?? "—"}</td>
              <td className="r num">{eur(d.askingPrice)}</td>
              <td className="r num">{eur(d.expectedPrice)}</td>
              <td className={`r num ${edgeClass(d.zScore)}`}>{pct(d.edgePercent)}</td>
              <td className="r num">{d.zScore.toFixed(1)}</td>
              <td>{d.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
