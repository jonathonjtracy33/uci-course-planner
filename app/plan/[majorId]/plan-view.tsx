"use client";

import { useEffect, useMemo, useState } from "react";
import type { CourseInfo, PlanPage } from "@/lib/data";
import type { PlannedItem, Quarter } from "@/lib/planner";

const FULL_LOAD = 16; // a typical full-time quarter

const baseId = (id: string) => id.split("#")[0];
const shortName = (name: string) => name.replace(/^Major in /, "");

type Role = "selected" | "requires" | "unlocks" | "dimmed" | null;

export function PlanView({ major, plan, info }: PlanPage) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(() => new Map(plan.quarters.flatMap((q) => q.items).concat(plan.unscheduled.map((u) => u.item)).map((i) => [i.id, i])), [plan]);
  const quarterOf = useMemo(() => new Map(plan.quarters.flatMap((q) => q.items.map((i) => [i.id, q.label] as const))), [plan]);
  const dependents = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const i of items.values()) for (const p of [...i.prereqs, ...i.coreqs]) map.set(p, [...(map.get(p) ?? []), i.id]);
    return map;
  }, [items]);

  // Everything the selected course transitively requires, and everything it unlocks.
  const { requires, unlocks } = useMemo(() => {
    const walk = (start: string, next: (id: string) => string[]) => {
      const seen = new Set<string>();
      const stack = [...next(start)];
      while (stack.length) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        stack.push(...next(id));
      }
      return seen;
    };
    if (!selectedId) return { requires: new Set<string>(), unlocks: new Set<string>() };
    return {
      requires: walk(selectedId, (id) => { const i = items.get(id); return i ? [...i.prereqs, ...i.coreqs] : []; }),
      unlocks: walk(selectedId, (id) => dependents.get(id) ?? []),
    };
  }, [selectedId, items, dependents]);

  const roleOf = (id: string): Role => {
    if (!selectedId) return null;
    if (id === selectedId) return "selected";
    if (requires.has(id)) return "requires";
    if (unlocks.has(id)) return "unlocks";
    return "dimmed";
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelectedId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const all = [...items.values()];
  const totalUnits = all.reduce((s, i) => s + i.units, 0);
  const years = Array.from({ length: Math.ceil(plan.quarters.length / 3) }, (_, y) => plan.quarters.slice(y * 3, y * 3 + 3));
  const selected = selectedId ? items.get(selectedId) ?? null : null;
  const select = (id: string) => setSelectedId((cur) => (cur === id ? null : id));

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{shortName(major.name)}</h1>
          {major.catalogYear && <p className="mt-1 text-sm text-muted">Requirements from the {major.catalogYear.slice(0, 4)}–{major.catalogYear.slice(4)} catalog</p>}
        </div>
        <dl className="flex gap-6 text-sm">
          <Stat label="Courses" value={all.length} />
          <Stat label="Major units" value={totalUnits} />
          <Stat label="Per quarter" value={`~${plan.majorUnitsPerQuarter}`} />
        </dl>
      </header>

      {plan.warnings.length > 0 && (
        <ul className="mt-6 space-y-1 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {plan.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <Legend className="border-l-brand bg-brand-soft" label="Major requirement" />
        <Legend className="border-l-gold bg-gold-soft" label="Prerequisite" />
        <Legend className="border-dashed border-muted" label="Elective slot" />
        <span className="hidden sm:inline">· Click a course to see what it requires and unlocks</span>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6">
        <div className="min-w-0 space-y-6">
          {years.map((quarters, y) => (
            <section key={y} aria-labelledby={`year-${y}`}>
              <h2 id={`year-${y}`} className="mb-2 text-sm font-semibold text-muted">
                Year {y + 1}{y >= 4 && " (overflow)"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {quarters.map((q) => <QuarterCard key={q.label} quarter={q} info={info} roleOf={roleOf} onSelect={select} />)}
              </div>
            </section>
          ))}

          {plan.unscheduled.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted">Couldn&apos;t schedule</h2>
              <ul className="space-y-2">
                {plan.unscheduled.map(({ item, reason }) => (
                  <li key={item.id} className="text-sm">
                    <CourseChip item={item} info={info} role={roleOf(item.id)} onSelect={select} />
                    <p className="mt-1 text-xs text-muted">{reason}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6">
            {selected ? (
              <CourseDetails item={selected} info={info} quarter={quarterOf.get(selected.id)} items={items} dependents={dependents.get(selected.id) ?? []} onSelect={select} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
                Select a course to see why it&apos;s in your plan, what it requires, and what it unlocks.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile: details slide up as a sheet */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface shadow-2xl lg:hidden">
          <CourseDetails item={selected} info={info} quarter={quarterOf.get(selected.id)} items={items} dependents={dependents.get(selected.id) ?? []} onSelect={select} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`inline-block h-3 w-4 rounded-sm border border-l-4 ${className}`} />
      {label}
    </span>
  );
}

function QuarterCard({ quarter, info, roleOf, onSelect }: { quarter: Quarter; info: Record<string, CourseInfo>; roleOf: (id: string) => Role; onSelect: (id: string) => void }) {
  const open = Math.max(0, FULL_LOAD - quarter.units);
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{quarter.label}</h3>
        <span className="text-xs tabular-nums text-muted">{quarter.units} units</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-background" aria-hidden>
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (quarter.units / FULL_LOAD) * 100)}%` }} />
      </div>
      <ul className="mt-3 flex-1 space-y-1.5">
        {quarter.items.map((item) => (
          <li key={item.id}><CourseChip item={item} info={info} role={roleOf(item.id)} onSelect={onSelect} /></li>
        ))}
      </ul>
      {open > 0 && <p className="mt-2 text-xs text-muted">+{open} units open for GEs</p>}
    </div>
  );
}

const roleStyles: Record<Exclude<Role, null>, string> = {
  selected: "ring-2 ring-brand",
  requires: "ring-2 ring-gold",
  unlocks: "ring-2 ring-brand/50",
  dimmed: "opacity-35",
};

function CourseChip({ item, info, role, onSelect }: { item: PlannedItem; info: Record<string, CourseInfo>; role: Role; onSelect: (id: string) => void }) {
  const code = item.placeholder ? "Elective" : info[baseId(item.id)]?.code ?? item.id;
  const isPrereq = item.reason.startsWith("Prerequisite");
  const kind = item.placeholder
    ? "border-dashed border-muted/60 bg-transparent"
    : isPrereq ? "border-l-4 border-l-gold bg-gold-soft" : "border-l-4 border-l-brand bg-brand-soft";
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-pressed={role === "selected"}
      className={`w-full rounded-lg border border-border px-2.5 py-1.5 text-left transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand ${kind} ${role ? roleStyles[role] : ""}`}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-xs font-semibold">{code}{item.id.includes("#") && ` (×${item.id.split("#")[1]})`}</span>
        <span className="text-[11px] tabular-nums text-muted">{item.units}u</span>
      </span>
      <span className="block truncate text-xs text-muted">{item.title}</span>
    </button>
  );
}

function CourseDetails({ item, info, quarter, items, dependents, onSelect, onClose }: {
  item: PlannedItem; info: Record<string, CourseInfo>; quarter?: string; items: Map<string, PlannedItem>; dependents: string[];
  onSelect: (id: string) => void; onClose: () => void;
}) {
  const details = info[baseId(item.id)];
  const codeOf = (id: string) => info[baseId(id)]?.code ?? id;
  const links = (ids: string[]) => ids.filter((id) => items.has(id)).map((id) => (
    <button key={id} type="button" onClick={() => onSelect(id)} className="rounded-md bg-background px-2 py-0.5 font-mono text-xs hover:text-brand">{codeOf(id)}</button>
  ));
  const requires = [...item.prereqs, ...item.coreqs];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 text-sm" role="region" aria-label="Course details">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-brand">{item.placeholder ? "Elective slot" : codeOf(item.id)}</p>
          <h3 className="mt-0.5 text-base font-semibold">{item.title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-md px-2 text-lg leading-none text-muted hover:text-foreground">×</button>
      </div>

      <dl className="mt-4 space-y-3">
        <Row label="Why it's here">{item.reason}</Row>
        <Row label="When">{quarter ?? "Not scheduled"} · {item.units} units</Row>
        {details && <Row label="Usually offered">{details.seasons.length ? details.seasons.join(", ") : "No recent offering data"}</Row>}
        {requires.length > 0 && <Row label="Requires"><span className="flex flex-wrap gap-1">{links(requires)}</span></Row>}
        {dependents.length > 0 && <Row label="Unlocks"><span className="flex flex-wrap gap-1">{links(dependents)}</span></Row>}
        {details?.prerequisiteText && <Row label="Catalog prerequisites"><span className="text-muted">{details.prerequisiteText}</span></Row>}
        {item.placeholder && <Row label="What to do">Pick a course from your department&apos;s approved list for this requirement.</Row>}
      </dl>

      {details?.description && <p className="mt-4 border-t border-border pt-4 text-muted">{details.description}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
