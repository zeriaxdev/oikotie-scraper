"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";

export function MarketControls({ type, city }: { type: string; city?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(city ?? "");

  const go = (nextType: string, nextCity: string) => {
    const q = new URLSearchParams({ type: nextType });
    if (nextCity.trim()) q.set("city", nextCity.trim());
    router.push(`/?${q}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex gap-6">
        {(["rent", "sale"] as const).map((t) => {
          const on = type === t;
          return (
            <button
              key={t}
              onClick={() => go(t, value)}
              className="relative pb-1 text-left"
            >
              <span
                className={`display text-xl capitalize transition-colors ${
                  on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </span>
              {on && (
                <motion.span
                  layoutId="type-underline"
                  className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(type, value);
        }}
        className="flex items-baseline gap-2"
      >
        <label className="eyebrow">Filter</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="any city"
          className="w-32 border-0 border-b border-foreground/30 bg-transparent pb-0.5 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-primary"
        />
        {city && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              go(type, "");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            clear
          </button>
        )}
      </form>
    </div>
  );
}
