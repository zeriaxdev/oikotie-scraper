"use client";

import { motion, useReducedMotion } from "motion/react";
import { EASE } from "./motion";

type Props = {
  bins: number[];
  lo: number;
  hi: number;
  median: number;
};

const fmt = (n: number) => Math.round(n).toLocaleString("fi-FI") + " €";

export function Distribution({ bins, lo, hi, median }: Props) {
  const reduce = useReducedMotion();
  const max = Math.max(...bins, 1);
  const medianFrac = hi > lo ? (median - lo) / (hi - lo) : 0.5;

  return (
    <figure className="m-0">
      <div className="relative flex h-32 items-end gap-[3px]">
        {/* median marker */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-primary/70"
          style={{ left: `${medianFrac * 100}%` }}
        >
          <span className="absolute -top-5 left-1 whitespace-nowrap text-[0.625rem] font-semibold text-primary">
            median {fmt(median)}
          </span>
        </div>
        {bins.map((count, i) => {
          const frac = (i + 0.5) / bins.length;
          const belowMedian = frac < medianFrac;
          return (
            <motion.span
              key={i}
              className={`flex-1 ${belowMedian ? "bg-primary/70" : "bg-primary/25"}`}
              style={{ height: `${(count / max) * 100}%`, originY: 1, minHeight: 1 }}
              initial={{ scaleY: reduce ? 1 : 0, opacity: reduce ? 1 : 0.4 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.01 }}
            />
          );
        })}
      </div>
      <figcaption className="mt-2 flex justify-between rule pt-1.5 text-[0.625rem] tabular-nums text-muted-foreground">
        <span>{fmt(lo)}</span>
        <span className="eyebrow">monthly rent distribution</span>
        <span>{fmt(hi)}</span>
      </figcaption>
    </figure>
  );
}
