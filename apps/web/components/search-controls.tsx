"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SearchValues = {
  type: string;
  city: string;
  district: string;
  minPrice: string;
  maxPrice: string;
  minSize: string;
  maxSize: string;
  rooms: string;
  sort: string;
};

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 border border-border bg-card px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function Menu({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <Select value={value} onValueChange={(val) => onChange((val as string | null) ?? "")}>
        <SelectTrigger className="h-9 rounded-none border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-none">
          {options.map(([val, lbl]) => (
            <SelectItem key={val} value={val} className="rounded-none">
              {lbl}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function SearchControls({ initial }: { initial: SearchValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [paste, setPaste] = useState("");
  const set = (k: keyof SearchValues) => (val: string) => setV((s) => ({ ...s, [k]: val }));

  const submit = () => {
    const q = new URLSearchParams();
    for (const [k, val] of Object.entries(v)) if (val && val !== "any") q.set(k, val);
    router.push(`/search?${q}`);
  };

  const jump = () => {
    const id = paste.match(/(\d{6,})/)?.[1];
    if (id) router.push(`/listings/${id}`);
  };

  return (
    <div>
      {/* open by URL / id */}
      <div className="flex items-center gap-3 border border-border bg-card px-4 py-3">
        <span className="eyebrow hidden shrink-0 sm:block">Open by URL / ID</span>
        <input
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && jump()}
          placeholder="paste an oikotie.fi link or a listing id…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
        <button onClick={jump} className="bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
          Open →
        </button>
      </div>

      {/* filters */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-9"
      >
        <Menu label="Type" value={v.type} onChange={set("type")} options={[["rent", "Rent"], ["sale", "Sale"]]} />
        <Field label="City" value={v.city} onChange={set("city")} placeholder="Helsinki" />
        <Field label="District" value={v.district} onChange={set("district")} placeholder="Kallio" />
        <Field label="Rooms" value={v.rooms} onChange={set("rooms")} placeholder="e.g. 2" type="number" />
        <Field label="Min €" value={v.minPrice} onChange={set("minPrice")} type="number" />
        <Field label="Max €" value={v.maxPrice} onChange={set("maxPrice")} type="number" />
        <Field label="Min m²" value={v.minSize} onChange={set("minSize")} type="number" />
        <Field label="Max m²" value={v.maxSize} onChange={set("maxSize")} type="number" />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Menu
              label="Sort"
              value={v.sort}
              onChange={set("sort")}
              options={[
                ["price", "€ ↑"],
                ["-price", "€ ↓"],
                ["size", "m² ↑"],
                ["-size", "m² ↓"],
                ["newest", "Newest"],
                ["popular", "Popular"],
              ]}
            />
          </div>
          <button type="submit" className="h-9 shrink-0 bg-primary px-4 text-sm font-medium text-primary-foreground">
            Search
          </button>
        </div>
      </form>
    </div>
  );
}
