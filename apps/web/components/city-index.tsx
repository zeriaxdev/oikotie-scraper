"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { EASE } from "./motion";

type City = {
  city: string;
  count: number;
  medianPrice: number;
  medianPpm2: number;
  modelR2: number | null;
};

const eur = (n: number) => Math.round(n).toLocaleString("fi-FI") + " €";

export function CityIndex({
  cities,
  type,
  active,
}: {
  cities: City[];
  type: string;
  active?: string;
}) {
  const reduce = useReducedMotion();
  const cell: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };

  return (
    <div>
      <p className="eyebrow mb-5">Index · {cities.length} cities</p>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: reduce ? 0 : 0.04 } } }}
        className="grid grid-cols-1 border-l border-t border-border sm:grid-cols-2"
      >
        {cities.map((c) => {
          const isActive = active?.toLowerCase() === c.city.toLowerCase();
          return (
            <motion.div key={c.city} variants={cell}>
              <Link
                href={`/?type=${type}&city=${encodeURIComponent(c.city)}`}
                scroll={false}
                className={`group block border-b border-r border-border px-6 py-6 transition-colors hover:bg-accent ${
                  isActive ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <h3
                    className={`display text-2xl transition-colors ${
                      isActive ? "text-primary" : "group-hover:text-primary"
                    }`}
                  >
                    {c.city}
                  </h3>
                  <span className="translate-x-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
                    →
                  </span>
                </div>
                <div className="figure mt-3 text-2xl">{eur(c.medianPrice)}</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    {c.count.toLocaleString("fi-FI")} listings
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {c.medianPpm2.toFixed(1)} €/m²
                    {c.modelR2 != null && ` · R² ${c.modelR2.toFixed(2)}`}
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
