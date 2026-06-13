"use client";

import Link from "next/link";
import { Stagger, Item } from "./motion";

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
  return (
    <Stagger className="grid grid-cols-1 gap-x-12 sm:grid-cols-2" gap={0.05}>
      {cities.map((c) => {
        const isActive = active?.toLowerCase() === c.city.toLowerCase();
        return (
          <Item key={c.city}>
            <Link
              href={`/?type=${type}&city=${encodeURIComponent(c.city)}`}
              scroll={false}
              className="group block rule py-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  className={`display text-2xl transition-colors ${
                    isActive ? "text-primary" : "group-hover:text-primary"
                  }`}
                >
                  {c.city}
                  <span className="ml-2 inline-block translate-x-0 text-base opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">
                    →
                  </span>
                </h3>
                <div className="display text-2xl tabular-nums">{eur(c.medianPrice)}</div>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="eyebrow">
                  {c.count.toLocaleString("fi-FI")} listings
                  {c.modelR2 != null && ` · model fit ${c.modelR2.toFixed(2)}`}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {c.medianPpm2.toFixed(1)} €/m²
                </span>
              </div>
            </Link>
          </Item>
        );
      })}
    </Stagger>
  );
}
