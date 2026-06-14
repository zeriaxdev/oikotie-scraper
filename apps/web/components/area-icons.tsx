// Icon + colour per area-profile type, so transport & amenities are scannable
// at a glance. Transit uses Helsinki's real mode colours.
import type { ReactNode } from "react";

type Meta = { color: string; paths: ReactNode; label: string };

const I = (paths: ReactNode) => paths;

const META: Record<string, Meta> = {
  bus: {
    color: "#2563eb",
    label: "Bus",
    paths: I(<><path d="M4 6h16v8H4zM4 14v3M20 14v3M6 10h12M7 18.5h.01M17 18.5h.01" /></>),
  },
  tram: {
    color: "#16a34a",
    label: "Tram",
    paths: I(<><rect x="5" y="3.5" width="14" height="13" rx="2" /><path d="M7 16.5l-2 4M17 16.5l2 4M5 9h14M12 3.5V2M9 20.5h6" /></>),
  },
  metro: {
    color: "#ea580c",
    label: "Metro",
    paths: I(<><rect x="4.5" y="4" width="15" height="12" rx="2" /><path d="M7 16l-2 4M17 16l2 4M9 9l3 3 3-3M8.5 19.5h7" /></>),
  },
  train: {
    color: "#7c3aed",
    label: "Train",
    paths: I(<><rect x="5" y="3.5" width="14" height="12" rx="3" /><path d="M5 11h14M8 15.5l-2 5M16 15.5l2 5M9 19.5h6M9.5 8h.01M14.5 8h.01" /></>),
  },
  store: { color: "#0891b2", label: "Groceries", paths: I(<><path d="M4 7h16l-1.2 10.5a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8zM8.5 7V5a3.5 3.5 0 0 1 7 0v2" /></>) },
  restaurant: { color: "#db2777", label: "Restaurant", paths: I(<><path d="M7 2v7a2 2 0 0 0 2 2v9M7 2v4M10 2v4M16 2c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9" /></>) },
  library: { color: "#ca8a04", label: "Library", paths: I(<><path d="M5 4h6v16H5zM5 8h6M13 4h6v16h-6zM13 9h6" /></>) },
  postalOffice: { color: "#2563eb", label: "Post", paths: I(<><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="M4 8l8 5 8-5" /></>) },
  school: { color: "#d97706", label: "School", paths: I(<><path d="M3 8l9-4 9 4-9 4zM7 10.5V15c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4.5M21 8v5" /></>) },
  daycare: { color: "#16a34a", label: "Daycare", paths: I(<><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /></>) },
  playground: { color: "#16a34a", label: "Playground", paths: I(<><path d="M5 20V9l7-5 7 5v11M5 13h14M12 20v-7" /></>) },
  hospital: { color: "#dc2626", label: "Hospital", paths: I(<><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M12 8v8M8 12h8" /></>) },
  healthCenter: { color: "#dc2626", label: "Health centre", paths: I(<><path d="M12 21s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.7-7 10-7 10z" /></>) },
  pharmacy: { color: "#16a34a", label: "Pharmacy", paths: I(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8.5v7M8.5 12h7" /></>) },
  dentist: { color: "#0891b2", label: "Dentist", paths: I(<><path d="M7 3c-2 0-3 2-3 5 0 4 1.5 13 3 13s1.5-5 3-5 1.5 5 3 5 3-9 3-13c0-3-1-5-3-5-1.5 0-2 1-3 1s-1.5-1-3-1z" /></>) },
  indoors: { color: "#7c3aed", label: "Gym / sport", paths: I(<><path d="M6.5 7v10M17.5 7v10M4 9.5v5M20 9.5v5M6.5 12h11" /></>) },
};

const DEFAULT: Meta = {
  color: "var(--muted-foreground)",
  label: "Place",
  paths: I(<><circle cx="12" cy="12" r="3" /></>),
};

export function areaMeta(type: string): Meta {
  return META[type] ?? DEFAULT;
}

export function AreaIcon({ type, size = 16 }: { type: string; size?: number }) {
  const m = areaMeta(type);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={m.color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {m.paths}
    </svg>
  );
}

/** "1 min kävellen" → { mins: 1, mode: "walk" } */
export function parseTravel(t: string): { label: string; mode: "walk" | "drive" | "transit" } {
  const mins = t.match(/(\d+)\s*min/)?.[1];
  const mode = /kävellen|walk/i.test(t) ? "walk" : /autolla|car|drive/i.test(t) ? "drive" : "transit";
  const label = mins ? `${mins} min` : t;
  return { label, mode };
}
