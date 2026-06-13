import {
  valuateListing,
  getCityModel,
  findComparables,
  getOrFetchDetail,
  serializeValuation,
  serializeDetailRow,
  eur,
  pct,
} from "@/lib/data";

export const dynamic = "force-dynamic";

function verdictClass(z: number) {
  return z <= -1 ? "v-pos" : z >= 1 ? "v-neg" : "v-neu";
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  const v = valuateListing(id);

  if (!v) {
    return (
      <main className="wrap">
        <a className="back" href="/">← Back</a>
        <h1>Listing {id}</h1>
        <p className="meta">
          Can't analyze this listing — not found, missing price/size, or too little data for its city.
        </p>
      </main>
    );
  }

  const val = serializeValuation(v);
  const model = v.row.city ? getCityModel(v.row.type, v.row.city) : null;
  const comparables = model ? findComparables(model, v.row) : [];
  const detail = serializeDetailRow(await getOrFetchDetail(id));

  const yn = (b: boolean | null | undefined) => (b == null ? null : b ? "Yes" : "No");
  const rows: [string, unknown][] = [];
  const add = (k: string, x: unknown) => {
    if (x != null && x !== "") rows.push([k, x]);
  };
  if (detail) {
    add("Availability", detail.availabilityInfo);
    add("Rent term", detail.rentTermInfo);
    add("Kitchen", detail.kitchenAppliances);
    add("Bathroom", detail.bathroomAppliances);
    add("Storage", detail.storageInfo);
    add("Balcony", detail.balconyInfo);
    add("Terrace", yn(detail.hasTerrace as boolean | null));
    add(
      "Sauna",
      detail.sauna != null
        ? yn(detail.sauna as boolean) + (detail.saunaInfo ? ` — ${detail.saunaInfo}` : "")
        : null,
    );
    add("Lift", yn(detail.lift as boolean | null));
    add("Heating", detail.heatingInfo);
    add("Energy class", detail.energyClass);
    add("Building floors", detail.buildingFloors);
    add("Water fee", detail.waterFeeInfo);
    add("Deposit", detail.securityDepositInfo);
    add("Other terms", detail.otherTerms);
  }

  return (
    <main className="wrap">
      <a className="back" href="/">← Back to market</a>
      <h1 style={{ marginTop: 12 }}>
        <a href={val.url} target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>
          {val.address ?? `Listing ${id}`} ↗
        </a>
      </h1>
      <p className="meta">
        {[val.district, val.city, val.roomConfig, val.sizeM2 ? `${val.sizeM2} m²` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="estrow">
        <div>
          <div className="meta">Asking</div>
          <div className="big num">{eur(val.askingPrice)}</div>
        </div>
        <div>
          <div className="meta">Model estimate</div>
          <div className="big num" style={{ color: "var(--muted)" }}>{eur(val.expectedPrice)}</div>
        </div>
      </div>

      <div style={{ margin: "10px 0" }}>
        <span className={`verdict ${verdictClass(val.zScore)}`}>{val.verdict}</span>
        <span className="meta num" style={{ marginLeft: 10 }}>
          edge {pct(val.edgePercent)} · z {val.zScore.toFixed(2)} · score {val.dealScore}/100
        </span>
      </div>
      {val.flags.length > 0 && (
        <div style={{ margin: "8px 0" }}>
          {val.flags.map((f) => (
            <span key={f} className="flag">{f}</span>
          ))}
        </div>
      )}

      <dl className="kv">
        <dt>Confidence</dt>
        <dd>
          {val.confidence}{" "}
          <span className="meta">R² {val.model.r2.toFixed(2)}, district n={val.model.districtN}</span>
        </dd>
        {val.districtPpm2Percentile != null && (
          <>
            <dt>€/m² in district</dt>
            <dd className="num">{val.districtPpm2Percentile}th percentile</dd>
          </>
        )}
        <dt>Demand</dt>
        <dd className="num">
          {val.visitsWeekly}/wk · {val.demandPercentile}th percentile in {val.city}
        </dd>
      </dl>

      {rows.length > 0 && (
        <>
          <h2>Details</h2>
          <dl className="kv">
            {rows.map(([k, x]) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>{k}</dt>
                <dd>{String(x)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {comparables.length > 0 && (
        <>
          <h2>Closest comparables</h2>
          <table>
            <thead>
              <tr>
                <th>Address</th>
                <th>Config</th>
                <th className="r">Size</th>
                <th className="r">Price</th>
                <th className="r">€/m²</th>
              </tr>
            </thead>
            <tbody>
              {comparables.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`/listings/${c.id}`} style={{ color: "var(--blue)" }}>
                      {c.address ?? "—"}
                    </a>
                  </td>
                  <td>{c.room_config ?? "—"}</td>
                  <td className="r num">{c.size_m2} m²</td>
                  <td className="r num">{eur(c.price)}</td>
                  <td className="r num">{(c.price / c.size_m2).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {detail?.description ? (
        <>
          <h2>Description</h2>
          <p className="desc">{String(detail.description)}</p>
        </>
      ) : null}
    </main>
  );
}
