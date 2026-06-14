import { AreaIcon, parseTravel } from "./area-icons";

type Item = { type: string; name: string; travelTime: string; description?: string };
type Section = { content?: Item[] } | undefined;

export type AreaProfile = {
  transportation?: Section;
  services?: Section;
  family?: Section;
  healthcare?: Section;
  activities?: Section;
} | null;

function ModeDot({ mode }: { mode: "walk" | "drive" | "transit" }) {
  const color = mode === "walk" ? "var(--good)" : "var(--muted-foreground)";
  return <span className="size-1.5 shrink-0 rounded-full" style={{ background: color }} title={mode} />;
}

function Group({ title, items }: { title: string; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <ul className="space-y-0">
        {items.map((it, i) => {
          const t = parseTravel(it.travelTime);
          return (
            <li key={i} className="flex items-center gap-3 border-b border-border py-2.5">
              <AreaIcon type={it.type} />
              <span className="flex-1 truncate text-sm">{it.name}</span>
              <ModeDot mode={t.mode} />
              <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {t.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AreaSection({ area }: { area: AreaProfile }) {
  if (!area) {
    return <p className="text-sm text-muted-foreground">Neighbourhood data unavailable for this listing.</p>;
  }
  const transport = area.transportation?.content ?? [];
  const services = area.services?.content ?? [];
  const family = area.family?.content ?? [];
  const health = area.healthcare?.content ?? [];
  const activities = area.activities?.content ?? [];

  if (transport.length + services.length + family.length + health.length + activities.length === 0) {
    return <p className="text-sm text-muted-foreground">Neighbourhood data unavailable for this listing.</p>;
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-4">
        <p className="eyebrow">Neighbourhood</p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ background: "var(--good)" }} /> walk
          <span className="ml-2 size-1.5 rounded-full" style={{ background: "var(--muted-foreground)" }} /> drive
        </span>
      </div>
      <div className="grid grid-cols-1 gap-x-12 gap-y-7 sm:grid-cols-2">
        <Group title="Transport" items={transport.slice(0, 6)} />
        <Group title="Services" items={services.slice(0, 6)} />
        <Group title="Family" items={family.slice(0, 5)} />
        <Group title="Health" items={health.slice(0, 5)} />
        <Group title="Activities" items={activities.slice(0, 5)} />
      </div>
    </div>
  );
}
