"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { EASE } from "./motion";

export type Deal = {
  id: number;
  address: string | null;
  district: string | null;
  city: string | null;
  askingPrice: number | null;
  expectedPrice: number;
  edgePercent: number;
  zScore: number;
  dealScore: number;
  confidence: string;
  flags: string[];
  disqualified: boolean;
  livability: number;
  trueCost: number;
};

const RED = new Set(["renovation", "sublet", "shared", "short-term", "suspicious"]);

const eur = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("fi-FI") + " €");
const pct = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";

export function DealLedger({ deals }: { deals: Deal[] }) {
  const router = useRouter();
  const reduce = useReducedMotion();

  const row: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  };

  if (deals.length === 0) {
    return (
      <p className="rule py-10 text-center text-sm text-muted-foreground">
        No listings priced below the model here yet. Try another city, or widen the net.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="eyebrow rule border-b text-left [&>th]:pb-2 [&>th]:pr-4 [&>th]:font-semibold">
            <th className="w-12 text-right">No.</th>
            <th>Address</th>
            <th className="hidden sm:table-cell">District</th>
            <th className="text-right">Asking</th>
            <th className="hidden text-right lg:table-cell">True cost</th>
            <th className="text-right">Edge</th>
            <th className="hidden text-right md:table-cell">Value</th>
            <th className="text-right">Livability</th>
          </tr>
        </thead>
        <motion.tbody
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.035, delayChildren: 0.1 } } }}
        >
          {deals.map((d, i) => (
            <motion.tr
              key={d.id}
              variants={row}
              onClick={() => router.push(`/listings/${d.id}`)}
              className={`group cursor-pointer rule border-b align-baseline transition-colors hover:bg-accent/60 [&>td]:py-3 [&>td]:pr-4 ${
                d.disqualified ? "opacity-60" : ""
              }`}
            >
              <td className="text-right font-serif text-sm tabular-nums text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td>
                <Link
                  href={`/listings/${d.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium leading-tight transition-colors group-hover:text-primary"
                >
                  {d.address ?? "—"}
                </Link>
                <span className="ml-2 inline text-xs text-muted-foreground sm:hidden">
                  {d.district}
                </span>
                {d.flags.filter((f) => RED.has(f)).map((f) => (
                  <span
                    key={f}
                    className="ml-2 align-middle text-[0.625rem] uppercase tracking-wider"
                    style={{ color: "var(--bad)" }}
                  >
                    {f}
                  </span>
                ))}
                {d.flags.includes("new") && !d.disqualified && (
                  <span className="ml-2 align-middle text-[0.625rem] uppercase tracking-wider text-primary">
                    new
                  </span>
                )}
              </td>
              <td className="hidden text-sm text-muted-foreground sm:table-cell">{d.district ?? "—"}</td>
              <td className="text-right tabular-nums">{eur(d.askingPrice)}</td>
              <td className="hidden text-right tabular-nums lg:table-cell">
                {eur(d.trueCost)}
                <span className="text-muted-foreground">/mo</span>
              </td>
              <td
                className="text-right font-medium tabular-nums"
                style={{ color: d.zScore <= -1 ? "var(--good)" : d.zScore >= 1 ? "var(--bad)" : undefined }}
              >
                {pct(d.edgePercent)}
              </td>
              <td className="hidden text-right tabular-nums text-muted-foreground md:table-cell">
                {d.dealScore}
              </td>
              <td className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  <span className="hidden h-1 w-10 overflow-hidden rounded-full bg-border sm:inline-block">
                    <span className="block h-full bg-primary" style={{ width: `${d.livability}%` }} />
                  </span>
                  <span className="figure text-base text-primary">{d.livability}</span>
                </span>
              </td>
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
