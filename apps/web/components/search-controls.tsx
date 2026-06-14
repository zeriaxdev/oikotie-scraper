"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  label, name, value, onChange, placeholder, type = "text", width = "w-full",
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; width?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${width}`}>
      <span className="eyebrow">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
      />
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
      {/* paste an Oikotie URL or id */}
      <div className="flex items-center gap-3 border border-border bg-card px-4 py-3">
        <span className="eyebrow shrink-0">Open by URL / ID</span>
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
        className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8"
      >
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Type</span>
          <select
            value={v.type}
            onChange={(e) => set("type")(e.target.value)}
            className="border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="rent">Rent</option>
            <option value="sale">Sale</option>
          </select>
        </label>
        <Field label="City" name="city" value={v.city} onChange={set("city")} placeholder="Helsinki" />
        <Field label="District" name="district" value={v.district} onChange={set("district")} placeholder="Kallio" />
        <Field label="Min €" name="minPrice" type="number" value={v.minPrice} onChange={set("minPrice")} />
        <Field label="Max €" name="maxPrice" type="number" value={v.maxPrice} onChange={set("maxPrice")} />
        <Field label="Min m²" name="minSize" type="number" value={v.minSize} onChange={set("minSize")} />
        <Field label="Max m²" name="maxSize" type="number" value={v.maxSize} onChange={set("maxSize")} />
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="eyebrow">Sort</span>
            <select
              value={v.sort}
              onChange={(e) => set("sort")(e.target.value)}
              className="border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="price">€ ↑</option>
              <option value="-price">€ ↓</option>
              <option value="size">m² ↑</option>
              <option value="-size">m² ↓</option>
              <option value="newest">Newest</option>
              <option value="popular">Popular</option>
            </select>
          </label>
          <button type="submit" className="h-[38px] bg-primary px-4 text-sm font-medium text-primary-foreground">
            Search
          </button>
        </div>
      </form>
    </div>
  );
}
