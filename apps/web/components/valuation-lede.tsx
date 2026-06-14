"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE } from "./motion";

type Val = {
  askingPrice: number | null;
  expectedPrice: number;
  estimateLow: number;
  estimateHigh: number;
  edgePercent: number;
  zScore: number;
  verdict: string;
  dealScore: number;
  confidence: string;
  model: { r2: number; districtN: number; sigma: number };
  districtPpm2Percentile: number | null;
  demandPercentile: number;
  visitsWeekly: number;
  city: string | null;
  flags: string[];
};

const eur = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("fi-FI") + " €");
const pct = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1) + "%";

function Cell({
  label,
  children,
  color,
}: {
  label: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="border-l border-border pl-4 first:border-l-0 first:pl-0">
      <div className="eyebrow">{label}</div>
      <div className="figure mt-1.5 text-[clamp(1.6rem,3.2vw,2.4rem)]" style={color ? { color } : undefined}>
        {children}
      </div>
    </div>
  );
}

export function ValuationLede({ v }: { v: Val }) {
  const reduce = useReducedMotion();
  const below = v.edgePercent < 0;
  const signal = v.zScore <= -1 ? "var(--good)" : v.zScore >= 1 ? "var(--bad)" : "var(--muted-foreground)";
  const clamped = Math.max(-40, Math.min(40, v.edgePercent));
  const askingLeft = ((clamped + 40) / 80) * 100;

  return (
    <div>
      <div className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
        <Cell label="Asking">{eur(v.askingPrice)}</Cell>
        <Cell label="Model estimate" color="var(--muted-foreground)">
          {eur(v.expectedPrice)}
          <span className="mt-1 block text-xs font-normal tabular-nums text-muted-foreground">
            typical {eur(v.estimateLow)}–{eur(v.estimateHigh)}
          </span>
        </Cell>
        <Cell label="Edge" color={signal}>
          {pct(v.edgePercent)}
        </Cell>
        <Cell label="Deal score" color="var(--primary)">
          {v.dealScore}
          <span className="ml-0.5 text-base font-normal text-muted-foreground">/100</span>
        </Cell>
      </div>

      {/* edge gauge */}
      <div className="relative mt-10 h-9">
        <div className="absolute inset-x-0 top-4 h-px bg-border" />
        <div className="absolute top-1 left-1/2 h-6 w-px -translate-x-1/2 bg-foreground/30" />
        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[0.625rem] text-muted-foreground">
          estimate
        </span>
        <motion.div
          className="absolute top-4 h-0.5"
          style={{
            background: signal,
            left: `${Math.min(50, askingLeft)}%`,
            right: `${100 - Math.max(50, askingLeft)}%`,
          }}
          initial={{ scaleX: reduce ? 1 : 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
        />
        <motion.div
          className="absolute top-[5px] h-[18px] w-[3px]"
          style={{ background: signal }}
          initial={{ left: "calc(50% - 1.5px)", opacity: reduce ? 1 : 0 }}
          animate={{ left: `calc(${askingLeft}% - 1.5px)`, opacity: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
        />
      </div>

      <p className="display mt-8 max-w-2xl text-[clamp(1.5rem,3.2vw,2.2rem)] leading-[1.05]">
        Listed{" "}
        <span style={{ color: signal }}>
          {Math.abs(v.edgePercent).toFixed(1)}% {below ? "below" : "above"}
        </span>{" "}
        the model — {v.verdict}.
      </p>

      <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-3 text-sm">
        <div>
          <dt className="eyebrow">Confidence</dt>
          <dd className="mt-1 capitalize">
            {v.confidence}{" "}
            <span className="text-muted-foreground">· R² {v.model.r2.toFixed(2)}, n={v.model.districtN}</span>
          </dd>
        </div>
        {v.districtPpm2Percentile != null && (
          <div>
            <dt className="eyebrow">€/m² in district</dt>
            <dd className="mt-1 tabular-nums">{v.districtPpm2Percentile}th pct</dd>
          </div>
        )}
        <div>
          <dt className="eyebrow">Demand</dt>
          <dd className="mt-1 tabular-nums">
            {v.visitsWeekly}/wk · {v.demandPercentile}th pct
          </dd>
        </div>
        {v.flags.length > 0 && (
          <div>
            <dt className="eyebrow">Flags</dt>
            <dd className="mt-1 flex gap-1.5">
              {v.flags.map((f) => (
                <span key={f} className="border border-border px-2 py-0.5 text-[0.6875rem] uppercase tracking-wider">
                  {f}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <details className="group mt-7 border-t border-border pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <span className="transition-transform group-open:rotate-90">›</span>
          How is this estimate computed?
        </summary>
        <div className="mt-3 max-w-2xl space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            For each city we fit a <strong className="text-foreground">hedonic regression</strong> on{" "}
            <span className="text-foreground">log(rent)</span> using every comparable apartment:
            size, rooms, building age, floor and a fixed effect for each district (plus a furnished
            premium). The model learns what each attribute is worth, then predicts what{" "}
            <em>this</em> apartment should rent for.
          </p>
          <p>
            The estimate is a <strong className="text-foreground">conditional mean</strong>, not an
            exact figure — comparable apartments scatter around it. The{" "}
            <span className="text-foreground">typical range</span> shown ({eur(v.estimateLow)}–
            {eur(v.estimateHigh)}) is one robust standard deviation; roughly two-thirds of similar
            apartments fall inside it. The <span style={{ color: signal }}>edge</span> is how far the
            asking price sits from the estimate, and the <span className="text-foreground">z-score</span>{" "}
            ({v.zScore.toFixed(2)}) measures that gap in standard deviations — that, not the raw
            estimate, is what drives the deal score.
          </p>
          <p className="text-xs">
            Fit on {v.model.districtN} comparable listings in this district · model R²{" "}
            {v.model.r2.toFixed(2)} · serviced/sublet/renovation listings are excluded from the
            baseline. Small studios in premium areas have the widest spread — treat their estimates
            as a guide, and check the comparables below.
          </p>
        </div>
      </details>
    </div>
  );
}
