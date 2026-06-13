"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE } from "./motion";

type Val = {
  askingPrice: number | null;
  expectedPrice: number;
  edgePercent: number;
  zScore: number;
  verdict: string;
  dealScore: number;
  confidence: string;
  model: { r2: number; districtN: number };
  districtPpm2Percentile: number | null;
  demandPercentile: number;
  visitsWeekly: number;
  city: string | null;
  flags: string[];
};

const eur = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("fi-FI") + " €");

export function ValuationLede({ v }: { v: Val }) {
  const reduce = useReducedMotion();
  const below = v.edgePercent < 0;
  const signal = v.zScore <= -1 ? "var(--good)" : v.zScore >= 1 ? "var(--bad)" : "var(--muted-foreground)";
  // Asking position on a −40%…+40% track; estimate sits at center.
  const clamped = Math.max(-40, Math.min(40, v.edgePercent));
  const askingLeft = ((clamped + 40) / 80) * 100;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
        <div>
          <div className="eyebrow">Asking</div>
          <div className="display mt-1 text-[clamp(2.2rem,5vw,3.4rem)] tabular-nums">
            {eur(v.askingPrice)}
          </div>
        </div>
        <div>
          <div className="eyebrow">Model estimate</div>
          <div className="display mt-1 text-[clamp(2.2rem,5vw,3.4rem)] tabular-nums text-muted-foreground">
            {eur(v.expectedPrice)}
          </div>
        </div>
      </div>

      {/* edge gauge */}
      <div className="relative mt-7 h-9">
        <div className="absolute inset-x-0 top-4 h-px bg-border" />
        {/* estimate (center) marker */}
        <div className="absolute top-1 left-1/2 h-6 w-px -translate-x-1/2 bg-foreground/40" />
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[0.625rem] text-muted-foreground">
          estimate
        </span>
        {/* span between estimate and asking */}
        <motion.div
          className="absolute top-4 h-px"
          style={{
            background: signal,
            left: `${Math.min(50, askingLeft)}%`,
            right: `${100 - Math.max(50, askingLeft)}%`,
          }}
          initial={{ scaleX: reduce ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
        />
        {/* asking marker */}
        <motion.div
          className="absolute top-[5px] h-[18px] w-[3px] rounded"
          style={{ background: signal, left: `calc(${askingLeft}% - 1.5px)` }}
          initial={{ left: "calc(50% - 1.5px)", opacity: reduce ? 1 : 0 }}
          animate={{ left: `calc(${askingLeft}% - 1.5px)`, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
        />
      </div>

      <p className="display mt-6 max-w-2xl text-[clamp(1.4rem,3vw,2rem)] leading-tight">
        Listed{" "}
        <span style={{ color: signal }}>
          {Math.abs(v.edgePercent).toFixed(1)}% {below ? "below" : "above"}
        </span>{" "}
        the model — <span className="italic">{v.verdict}</span>.
      </p>

      <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-3 text-sm">
        <div>
          <dt className="eyebrow">Deal score</dt>
          <dd className="mt-0.5 tabular-nums">
            <span className="font-serif text-lg">{v.dealScore}</span>
            <span className="text-muted-foreground"> / 100</span>
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Confidence</dt>
          <dd className="mt-0.5 capitalize">
            {v.confidence}{" "}
            <span className="text-muted-foreground">
              · R² {v.model.r2.toFixed(2)}, n={v.model.districtN}
            </span>
          </dd>
        </div>
        {v.districtPpm2Percentile != null && (
          <div>
            <dt className="eyebrow">€/m² in district</dt>
            <dd className="mt-0.5 tabular-nums">{v.districtPpm2Percentile}th pct</dd>
          </div>
        )}
        <div>
          <dt className="eyebrow">Demand</dt>
          <dd className="mt-0.5 tabular-nums">
            {v.visitsWeekly}/wk · {v.demandPercentile}th pct
          </dd>
        </div>
      </dl>

      {v.flags.length > 0 && (
        <div className="mt-4 flex gap-2">
          {v.flags.map((f) => (
            <span
              key={f}
              className="rounded-sm border border-border px-2 py-0.5 text-[0.6875rem] uppercase tracking-wider text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
