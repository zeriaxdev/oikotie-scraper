"use client";

import { useRouter } from "next/navigation";

export type SearchItem = {
  id: number;
  imageUrl: string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  price: number | null;
  sizeM2: number | null;
  pricePerM2: number | null;
  roomConfig: string | null;
  rooms: number | null;
  visitsWeekly: number | null;
  livability: number | null;
  edgePercent: number | null;
  trueCost: number | null;
  flags: string[];
  disqualified: boolean;
};

const eur = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("fi-FI") + " €");
const RED = new Set(["renovation", "sublet", "shared", "short-term", "suspicious"]);

export function SearchResults({ items }: { items: SearchItem[] }) {
  const router = useRouter();

  if (items.length === 0) {
    return <p className="rule py-12 text-center text-sm text-muted-foreground">No listings match these filters.</p>;
  }

  return (
    <ul className="reveal-group border-t border-border">
      {items.map((l, i) => (
        <li
          key={l.id}
          onClick={() => router.push(`/listings/${l.id}`)}
          style={{ animationDelay: `${Math.min(i * 0.02, 0.3)}s` }}
          className={`reveal-row group grid cursor-pointer grid-cols-[64px_1fr] items-center gap-4 border-b border-border py-3 transition-colors hover:bg-accent sm:grid-cols-[72px_2fr_repeat(4,1fr)_auto] ${
            l.disqualified ? "opacity-60" : ""
          }`}
        >
          {/* thumbnail */}
          <div className="h-12 w-16 overflow-hidden rounded-sm bg-muted sm:h-13 sm:w-[72px]">
            {l.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={l.imageUrl}
                alt=""
                loading="lazy"
                width={72}
                height={52}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>

          {/* address + emphasized layout/size */}
          <div className="min-w-0">
            <div className="truncate font-medium transition-colors group-hover:text-primary">
              {l.address ?? "—"}
            </div>
            <div className="mt-0.5 flex items-baseline gap-2 text-sm">
              {l.roomConfig && <span className="font-semibold tracking-tight">{l.roomConfig}</span>}
              {l.sizeM2 != null && <span className="font-semibold tabular-nums tracking-tight">{l.sizeM2} m²</span>}
              <span className="truncate text-xs font-normal text-muted-foreground">· {l.district ?? ""}</span>
            </div>
            {(l.flags.some((f) => RED.has(f)) || (l.flags.includes("new") && !l.disqualified)) && (
              <div className="mt-0.5 text-xs">
                {l.flags.filter((f) => RED.has(f)).map((f) => (
                  <span key={f} className="mr-2 uppercase tracking-wider" style={{ color: "var(--bad)" }}>
                    {f}
                  </span>
                ))}
                {l.flags.includes("new") && !l.disqualified && (
                  <span className="uppercase tracking-wider text-primary">new</span>
                )}
              </div>
            )}
          </div>

          {/* stats (desktop) */}
          <div className="hidden text-right tabular-nums sm:block">
            <div className="font-medium">{eur(l.price)}</div>
            <div className="text-xs text-muted-foreground">{l.sizeM2 ?? "—"} m²</div>
          </div>
          <div className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
            {l.pricePerM2 ?? "—"}
            <div className="text-xs">€/m²</div>
          </div>
          <div className="hidden text-right text-sm tabular-nums sm:block">
            {l.trueCost != null ? (
              <>
                {eur(l.trueCost)}
                <div className="text-xs text-muted-foreground">true/mo</div>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="hidden text-right tabular-nums sm:block">
            {l.edgePercent != null ? (
              <span
                className="font-medium"
                style={{ color: l.edgePercent < -2 ? "var(--good)" : l.edgePercent > 2 ? "var(--bad)" : undefined }}
              >
                {l.edgePercent > 0 ? "+" : ""}
                {l.edgePercent.toFixed(0)}%
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <div className="text-xs text-muted-foreground">edge</div>
          </div>

          {/* mobile price + livability */}
          <div className="col-start-2 flex items-center justify-between sm:col-auto sm:justify-end">
            <span className="font-medium tabular-nums sm:hidden">{eur(l.price)}</span>
            {l.livability != null && (
              <span className="inline-flex items-center gap-1.5">
                <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-border sm:inline-block">
                  <span className="block h-full bg-primary" style={{ width: `${l.livability}%` }} />
                </span>
                <span className="figure text-base text-primary">{l.livability}</span>
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
