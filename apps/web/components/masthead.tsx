"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { EASE } from "./motion";

const DATELINE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

export function Masthead() {
  const reduce = useReducedMotion();
  return (
    <header className="mx-auto max-w-6xl px-6 pt-8">
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="flex items-baseline justify-between gap-4"
      >
        <div className="eyebrow hidden sm:block">Helsinki · Espoo</div>
        <div className="eyebrow">{DATELINE}</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}
        className="mt-2 flex items-end justify-between"
      >
        <Link href="/" className="group">
          <h1 className="display text-[clamp(2.4rem,6vw,4.25rem)] font-medium tracking-tight">
            Oikotie
          </h1>
        </Link>
        <p className="eyebrow mb-2 hidden text-right sm:block">
          A hedonic reading
          <br />
          of the rental market
        </p>
      </motion.div>

      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
        style={{ originX: 0 }}
        className="mt-3 h-px bg-foreground/70"
      />
      <div className="mt-1 h-px bg-border" />
    </header>
  );
}
