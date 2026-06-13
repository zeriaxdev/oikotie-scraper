"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarketControls({ type, city }: { type: string; city?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(city ?? "");

  const go = (nextType: string, nextCity: string) => {
    const q = new URLSearchParams({ type: nextType });
    if (nextCity.trim()) q.set("city", nextCity.trim());
    router.push(`/?${q}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-4">
      <span className="eyebrow text-primary-foreground/70">What are you renting?</span>
      <div className="flex gap-2">
        {(["rent", "sale"] as const).map((t) => {
          const on = type === t;
          return (
            <button
              key={t}
              onClick={() => go(t, value)}
              className={`pill ${
                on
                  ? "border-transparent bg-primary-foreground text-primary"
                  : "border-primary-foreground/35 text-primary-foreground/85 hover:border-primary-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${on ? "bg-primary" : "bg-primary-foreground/60"}`}
              />
              {t === "rent" ? "Rentals" : "For sale"}
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(type, value);
        }}
        className="ml-auto flex items-center gap-2"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="filter by city…"
          className="w-40 border-0 border-b border-primary-foreground/40 bg-transparent pb-1 text-sm text-primary-foreground outline-none placeholder:text-primary-foreground/50 focus:border-primary-foreground"
        />
        {city && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              go(type, "");
            }}
            className="text-xs text-primary-foreground/70 hover:text-primary-foreground"
          >
            clear
          </button>
        )}
      </form>
    </div>
  );
}
