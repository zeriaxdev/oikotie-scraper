"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { EASE } from "./motion";

type Provider = { id: string; name: string; marginPerKwh: number; basic: number; color: string };
type Spot = { avgEurPerKwh: number; nowEurPerKwh: number; min: number; max: number; hours: number[]; date: string };
type Electricity = { transferPerKwh: number; taxPerKwh: number; transferBasic: number; contractBasic: number };

export type CostInputs = {
  rent: number | null;
  maintenanceFee: number | null;
  waterPerPerson: number | null;
  insuranceMonthly: number | null;
  sizeM2: number;
  spot: Spot;
  electricity: Electricity;
  providers: Provider[];
  electricHeating: boolean;
};

const eur = (n: number) => Math.round(n).toLocaleString("fi-FI") + " €";
const eur1 = (n: number) => n.toLocaleString("fi-FI", { maximumFractionDigits: 0 }) + " €";

function annualKwh(size: number, persons: number, electricHeating: boolean) {
  const base = 1200 + 350 * persons + 8 * size;
  return electricHeating ? base + 100 * size : base;
}

function Row({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2.5">
      <span className={strong ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
        {label}
        {sub && <span className="ml-2 text-xs text-muted-foreground/70">{sub}</span>}
      </span>
      <span className={`tabular-nums ${strong ? "font-medium" : ""}`}>{value}</span>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fmt,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="text-sm tabular-nums font-medium">{fmt(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)] cursor-pointer"
      />
    </label>
  );
}

export function CostPanel({ inputs }: { inputs: CostInputs }) {
  const [persons, setPersons] = useState(1);
  const [electricHeating, setElectricHeating] = useState(inputs.electricHeating);
  const [kwh, setKwh] = useState(() => annualKwh(inputs.sizeM2, 1, inputs.electricHeating));
  const [providerId, setProviderId] = useState(inputs.providers[0]?.id ?? "");

  // Re-default consumption when persons / heating change (user can still override).
  const suggestedKwh = annualKwh(inputs.sizeM2, persons, electricHeating);
  const provider = inputs.providers.find((p) => p.id === providerId) ?? inputs.providers[0]!;
  const { spot, electricity } = inputs;

  const calc = useMemo(() => {
    const monthlyKwh = kwh / 12;
    const energy = monthlyKwh * (spot.avgEurPerKwh + provider.marginPerKwh) + provider.basic;
    const transfer = monthlyKwh * electricity.transferPerKwh + electricity.transferBasic;
    const tax = monthlyKwh * electricity.taxPerKwh;
    const electricityTotal = energy + transfer + tax;
    const water = (inputs.waterPerPerson ?? 22) * persons;
    const rent = inputs.rent ?? 0;
    const maintenance = inputs.maintenanceFee ?? 0;
    const insurance = inputs.insuranceMonthly ?? 0;
    return {
      monthlyKwh,
      electricityTotal,
      water,
      rent,
      maintenance,
      insurance,
      total: rent + maintenance + water + electricityTotal + insurance,
    };
  }, [kwh, persons, provider, spot, electricity, inputs]);

  // Per-provider electricity cost for the comparison (energy portion + fixed transfer/tax).
  const providerCosts = inputs.providers
    .map((p) => {
      const monthlyKwh = kwh / 12;
      const energy = monthlyKwh * (spot.avgEurPerKwh + p.marginPerKwh) + p.basic;
      const fixed = monthlyKwh * (electricity.transferPerKwh + electricity.taxPerKwh) + electricity.transferBasic;
      return { ...p, monthly: energy + fixed };
    })
    .sort((a, b) => a.monthly - b.monthly);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr]">
      {/* Breakdown */}
      <div className="border-border lg:border-r lg:pr-8">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">True monthly cost</p>
          <p className="text-xs text-muted-foreground">est. · adjust below</p>
        </div>
        <motion.div
          key={Math.round(calc.total)}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="figure mt-1 text-[clamp(2.4rem,5vw,3.4rem)] text-primary"
        >
          {eur(calc.total)}
          <span className="ml-1 text-base font-normal text-muted-foreground">/mo</span>
        </motion.div>

        <div className="mt-5">
          <Row label="Rent" value={eur1(calc.rent)} strong />
          {calc.maintenance > 0 && <Row label="Maintenance / parking" value={eur1(calc.maintenance)} />}
          <Row
            label="Water"
            sub={`${inputs.waterPerPerson != null ? `${inputs.waterPerPerson} €/person` : "~22 €/person est."} × ${persons}`}
            value={eur1(calc.water)}
          />
          <Row
            label="Electricity"
            sub={`${Math.round(calc.monthlyKwh)} kWh · ${provider.name}`}
            value={eur1(calc.electricityTotal)}
          />
          <Row
            label="Home insurance"
            sub={inputs.insuranceMonthly != null ? "If, for this size" : "n/a"}
            value={calc.insurance ? eur1(calc.insurance) : "—"}
          />
        </div>
      </div>

      {/* Controls + electricity */}
      <div className="mt-8 lg:mt-0 lg:pl-8">
        <div className="space-y-5">
          <Slider
            label="Household size"
            value={persons}
            min={1}
            max={5}
            step={1}
            onChange={(v) => {
              setPersons(v);
              setKwh(annualKwh(inputs.sizeM2, v, electricHeating));
            }}
            fmt={(v) => `${v} ${v === 1 ? "person" : "people"}`}
          />
          <Slider
            label="Electricity use / year"
            value={kwh}
            min={800}
            max={Math.max(8000, suggestedKwh * 1.5)}
            step={100}
            onChange={setKwh}
            fmt={(v) => `${(v / 1000).toFixed(1)} MWh`}
          />
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={electricHeating}
              onChange={(e) => {
                setElectricHeating(e.target.checked);
                setKwh(annualKwh(inputs.sizeM2, persons, e.target.checked));
              }}
              className="size-4 accent-[var(--primary)]"
            />
            Electric heating
          </label>
        </div>

        <div className="mt-7">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Electricity · spot {(spot.avgEurPerKwh * 100).toFixed(2)} c/kWh today</p>
            <Spark hours={spot.hours} />
          </div>
          <div className="mt-3 border-t border-border">
            {providerCosts.map((p) => {
              const on = p.id === provider.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProviderId(p.id)}
                  className={`flex w-full items-center justify-between border-b border-border py-2.5 text-left transition-colors hover:bg-accent ${
                    on ? "bg-accent" : ""
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="size-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-sm font-medium" style={{ color: p.color }}>{p.name}</span>
                    {on && <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">selected</span>}
                  </span>
                  <span className="text-sm tabular-nums">{eur1(p.monthly)}<span className="text-muted-foreground">/mo</span></span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted-foreground">
            Spot-price contracts · margins &amp; fees approximate. Transfer &amp; tax included. Spot via
            sähkönhintatanaan, insurance via If.
          </p>
        </div>
      </div>
    </div>
  );
}

function Spark({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 0.0001);
  return (
    <span className="flex h-5 items-end gap-px">
      {hours.map((h, i) => (
        <span
          key={i}
          className="w-[2px] bg-primary/40"
          style={{ height: `${Math.max(6, (h / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}
