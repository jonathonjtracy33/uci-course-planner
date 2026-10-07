"use client";

import { useEffect, useState } from "react";
import type { PlanPage, PlannerCourse } from "@/lib/data";
import { GE_CATEGORIES, geProgress, UNITS_TO_GRADUATE, type GeCourse } from "@/lib/ge";
import { buildPlan, SEASONS, type PlannedItem, type Quarter } from "@/lib/planner";
import { applyApCredit } from "@/lib/planner/ap";
import { unitsOf } from "@/lib/planner/select";
import { GePanel } from "./ge-panel";
import { catalogueUrl } from "@/lib/links";
import { courseStatus, type Missing, type StudentState } from "@/lib/prereq-status";
import { checkRestriction, type RestrictionCheck } from "@/lib/restrictions";
import { CoursePopover } from "./course-popover";
import { GePicker } from "./ge-picker";
import { SettingsPanel } from "./settings-panel";
import { useCourseIndex, useGeCourses } from "./use-course-index";
import { usePlanSettings } from "./use-plan-settings";

const FULL_LOAD = 16; // a typical full-time quarter

const baseId = (id: string) => id.split("#")[0];
const shortName = (name: string) => name.replace(/^Major in /, "");

type Role = "selected" | "requires" | "unlocks" | "dimmed" | null;
type Lookup = { courses: Map<string, PlannerCourse>; details: PlanPage["details"] };
export type CourseFacts = { code: string; title: string; units: number; ge: string[] };
type GeItem = { id: string; quarter: number; facts: CourseFacts | null };
const PLAN_QUARTERS = 12;

export function PlanView({ major, courses: courseList, details, apExams, entryYear, offeredSince }: PlanPage) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, update] = usePlanSettings(entryYear);
  const [picker, setPicker] = useState<{ quarter: number; category?: string } | null>(null);
  const [wantIndex, setWantIndex] = useState(false);
  const [popover, setPopover] = useState<{ id: string; quarter: number } | null>(null);

  // The whole planner runs here in the browser (~20 ms), so every setting change is instant.
  // The React Compiler memoizes these, so they only recompute when their inputs change.
  const courses = new Map(courseList.map((c) => [c.id, c]));
  const credit = applyApCredit(apExams, settings.ap);
  const plan = buildPlan(major.requirements, courses, {
    startYear: settings.entryYear,
    firstQuarter: settings.firstQuarter,
    maxUnitsPerQuarter: settings.maxUnits,
    completed: [...settings.taken, ...credit.completed],
    exams: credit.exams,
    offeredSince,
  });
  const lookup: Lookup = { courses, details };

  // Courses outside this major (taken elsewhere, or added as GEs) need the full course index.
  const index = useCourseIndex(wantIndex || picker !== null || settings.ge.length > 0 || settings.taken.some((id) => !courses.has(id)));
  const factsOf = (id: string): CourseFacts | null => {
    const c = courses.get(id);
    if (c) return { code: c.code, title: c.title, units: unitsOf(c), ge: c.ge };
    const i = index?.get(id);
    return i ? { code: i.code, title: i.title, units: i.units, ge: i.ge } : null;
  };

  // GE courses the student added. Ones in quarters before the plan starts count as taken.
  const geCourses = useGeCourses(picker !== null || settings.ge.length > 0);
  const geItems: GeItem[] = settings.ge.map((g) => ({ ...g, facts: factsOf(g.id) }));
  const geByQuarter = new Map<number, GeItem[]>();
  for (const g of geItems) if (g.quarter >= settings.firstQuarter) geByQuarter.set(g.quarter, [...(geByQuarter.get(g.quarter) ?? []), g]);
  const removeGe = (g: GeItem) => update({ ge: settings.ge.filter((x) => !(x.id === g.id && x.quarter === g.quarter)) });

  // Units toward the 180 needed to graduate.
  const doneIds = [...settings.taken, ...geItems.filter((g) => g.quarter < settings.firstQuarter).map((g) => g.id)];
  const unknownUnits = doneIds.some((id) => !factsOf(id));
  const unitsDone = doneIds.reduce((sum, id) => sum + (factsOf(id)?.units ?? 0), 0) + credit.units;
  const unitsNeeded = Math.max(0, UNITS_TO_GRADUATE - unitsDone);
  const quartersLeft = Math.max(1, PLAN_QUARTERS - settings.firstQuarter);

  const ge = geProgress(
    [
      ...[...doneIds, ...credit.completed].map((id): GeCourse => ({ id, ge: factsOf(id)?.ge ?? [], status: "done" })),
      ...plan.quarters.flatMap((q) => q.items).filter((i) => !i.placeholder).map((i): GeCourse => ({ id: baseId(i.id), ge: factsOf(baseId(i.id))?.ge ?? [], status: "planned" })),
      ...geItems.filter((g) => g.quarter >= settings.firstQuarter).map((g): GeCourse => ({ id: g.id, ge: g.facts?.ge ?? [], status: "planned" })),
    ],
    credit.ge,
  );

  const items = new Map(plan.quarters.flatMap((q) => q.items).concat(plan.unscheduled.map((u) => u.item)).map((i) => [i.id, i]));
  const quarterOf = new Map(plan.quarters.flatMap((q) => q.items.map((i) => [i.id, q.label] as const)));
  const dependents = new Map<string, string[]>();
  for (const i of items.values()) for (const p of [...i.prereqs, ...i.coreqs]) dependents.set(p, [...(dependents.get(p) ?? []), i.id]);

  // Everything the selected course transitively requires, and everything it unlocks.
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
  const requiresOf = (id: string) => walk(id, (x) => { const i = items.get(x); return i ? [...i.prereqs, ...i.coreqs] : []; });
  const selected = selectedId ? items.get(selectedId) ?? null : null;
  const requires = selected ? requiresOf(selected.id) : new Set<string>();
  const unlocks = selected ? walk(selected.id, (x) => dependents.get(x) ?? []) : new Set<string>();

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

  // Group by academic year; quarters before the plan starts show as done.
  const lastIndex = plan.quarters.at(-1)?.index ?? 11;
  const years = Array.from({ length: Math.floor(lastIndex / 3) + 1 }, (_, y) =>
    [0, 1, 2].map((s) => plan.quarters.find((q) => q.index === y * 3 + s) ?? { index: y * 3 + s, past: true as const }));
  const select = (id: string) => setSelectedId((cur) => (cur === id ? null : id));
  const quarterUnits = (q: Quarter) => q.units + (geByQuarter.get(q.index) ?? []).reduce((sum, g) => sum + (g.facts?.units ?? 0), 0);
  const planned = plan.quarters.filter((q) => q.index < PLAN_QUARTERS);
  // GE "Add" from the progress panel goes to the lightest quarter (the earliest one, for writing).
  const findGe = (category: string) => {
    const target = category === "GE-1A" ? planned[0] : [...planned].sort((a, b) => quarterUnits(a) - quarterUnits(b) || a.index - b.index)[0];
    if (target) setPicker({ quarter: target.index, category });
  };
  const pickerQuarter = picker ? plan.quarters.find((q) => q.index === picker.quarter) : undefined;

  // What the student will have finished before quarter q: courses taken, AP credit, and everything
  // planned earlier. Used to check GE prerequisites quarter by quarter.
  const examScores = new Map(Object.entries(credit.exams).map(([name, score]) => [name.toUpperCase(), score]));
  const studentBefore = (q: number): StudentState => {
    const earlier = plan.quarters.filter((x) => x.index < q).flatMap((x) => x.items.map((i) => baseId(i.id)));
    return {
      have: new Set([...settings.taken, ...credit.completed, ...earlier, ...settings.ge.filter((g) => g.quarter < q).map((g) => g.id)]),
      sameQuarter: new Set([...(plan.quarters.find((x) => x.index === q)?.items.map((i) => baseId(i.id)) ?? []), ...settings.ge.filter((g) => g.quarter === q).map((g) => g.id)]),
      exams: examScores,
    };
  };
  const standingIn = (q: number) => ({ year: Math.min(4, Math.floor(q / 3) + 1), majorName: major.name });
  // Problems with a GE the student added: missing prerequisites by then, or a restriction.
  const geIssues = (g: GeItem) => {
    const c = geCourses?.get(g.id);
    if (!c) return null;
    return { missing: courseStatus(c, studentBefore(g.quarter)).missing, restriction: checkRestriction(c.restriction, standingIn(g.quarter)) };
  };
  // Taking a course means its prerequisites were taken too.
  const markTaken = (id: string) => {
    const ids = [id, ...requiresOf(id)].map(baseId).filter((x) => courses.has(x));
    update({ taken: [...new Set([...settings.taken, ...ids])] });
    setSelectedId(null);
  };

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{shortName(major.name)}</h1>
          {major.catalogYear && <p className="mt-1 text-sm text-muted">Requirements from the {major.catalogYear.slice(0, 4)}–{major.catalogYear.slice(4)} catalog</p>}
        </div>
        <dl className="flex gap-6 text-sm">
          <Stat label="Units completed" value={unknownUnits && !index ? "…" : unitsDone} />
          <Stat label="Units needed" value={unknownUnits && !index ? "…" : unitsNeeded} hint={`of ${UNITS_TO_GRADUATE} to graduate`} />
          <Stat label="Per quarter" value={unknownUnits && !index ? "…" : Math.ceil(unitsNeeded / quartersLeft)} hint={`over ${quartersLeft} quarters`} />
        </dl>
      </header>

      <div className="mt-6">
        <SettingsPanel
          settings={settings}
          update={update}
          defaultEntryYear={entryYear}
          factsOf={factsOf}
          index={index}
          onSearchFocus={() => setWantIndex(true)}
          apExams={apExams}
          onReset={() => update({ entryYear, firstQuarter: 0, maxUnits: 16, taken: [], ap: {}, ge: [] })}
        />
      </div>

      <div className="mt-4">
        <GePanel progress={ge} onFind={findGe} />
      </div>

      {plan.warnings.length > 0 && (
        <ul className="mt-6 space-y-1 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {plan.warnings.map((w) => <li key={w}>⚠ {w}</li>)}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <Legend className="border-l-brand bg-brand-soft" label="Major requirement" />
        <Legend className="border-l-gold bg-gold-soft" label="Prerequisite" />
        <Legend className="border-dashed border-muted" label="Elective slot" />
        <Legend className="border-l-emerald-500 bg-emerald-500/10" label="GE you added" />
        <span className="hidden sm:inline">· Click a course to see what it requires and unlocks</span>
      </div>

      <div className="mt-4 lg:grid lg:grid-cols-[1fr_20rem] lg:gap-6">
        <div className="min-w-0 space-y-6">
          {years.map((quarters, y) => (
            <section key={y} aria-labelledby={`year-${y}`}>
              <h2 id={`year-${y}`} className="mb-2 text-sm font-semibold text-muted">
                Year {y + 1}{y >= 4 && " (past 4 years)"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {quarters.map((q) => "past" in q
                  ? <PastQuarter key={q.index} index={q.index} entryYear={settings.entryYear} />
                  : <QuarterCard key={q.index} quarter={q} lookup={lookup} roleOf={roleOf} onSelect={select} ge={geByQuarter.get(q.index) ?? []} geIssues={geIssues} onAddGe={() => setPicker({ quarter: q.index })} onRemoveGe={removeGe} onShowCourse={(id) => setPopover({ id, quarter: q.index })} />)}
              </div>
            </section>
          ))}

          {plan.unscheduled.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-muted">Couldn&apos;t schedule</h2>
              <ul className="space-y-2">
                {plan.unscheduled.map(({ item, reason }) => (
                  <li key={item.id} className="text-sm">
                    <CourseChip item={item} lookup={lookup} role={roleOf(item.id)} onSelect={select} />
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
              <CourseDetails item={selected} lookup={lookup} quarter={quarterOf.get(selected.id)} items={items} dependents={dependents.get(selected.id) ?? []} onSelect={select} onMarkTaken={markTaken} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">
                Select a course to see why it&apos;s in your plan, what it requires, and what it unlocks.
              </div>
            )}
          </div>
        </aside>
      </div>

      {picker && pickerQuarter && (
        <GePicker
          quarter={pickerQuarter}
          category={picker.category}
          geCourses={geCourses}
          progress={ge}
          student={studentBefore(picker.quarter)}
          standing={standingIn(picker.quarter)}
          openUnits={Math.max(0, FULL_LOAD - quarterUnits(pickerQuarter))}
          exclude={new Set([...settings.taken, ...credit.completed, ...settings.ge.map((g) => g.id), ...[...items.keys()].map(baseId)])}
          onAdd={(id) => update({ ge: [...settings.ge, { id, quarter: picker.quarter }] })}
          onShowCourse={(id) => setPopover({ id, quarter: picker.quarter })}
          onClose={() => setPicker(null)}
        />
      )}

      {popover && (
        <CoursePopover
          key={popover.id}
          courseId={popover.id}
          student={studentBefore(popover.quarter)}
          isTaken={(id) => settings.taken.includes(id) || credit.completed.includes(id)}
          onMarkTaken={(id) => update({ taken: [...new Set([...settings.taken, id])] })}
          onClose={() => setPopover(null)}
        />
      )}

      {/* Mobile: details slide up as a sheet */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface shadow-2xl lg:hidden">
          <CourseDetails item={selected} lookup={lookup} quarter={quarterOf.get(selected.id)} items={items} dependents={dependents.get(selected.id) ?? []} onSelect={select} onMarkTaken={markTaken} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-[11px] text-muted">{hint}</dd>}
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

function PastQuarter({ index, entryYear }: { index: number; entryYear: number }) {
  const season = SEASONS[index % 3];
  const year = entryYear + Math.floor(index / 3) + (season === "Fall" ? 0 : 1);
  return (
    <div className="hidden min-w-0 rounded-xl border border-dashed border-border p-3 text-sm text-muted sm:block">
      {season} {year} <span className="text-xs">· done</span>
    </div>
  );
}

type GeIssues = (g: GeItem) => { missing: Missing[]; restriction: RestrictionCheck } | null;

function QuarterCard({ quarter, lookup, roleOf, onSelect, ge, geIssues, onAddGe, onRemoveGe, onShowCourse }: {
  quarter: Quarter; lookup: Lookup; roleOf: (id: string) => Role; onSelect: (id: string) => void;
  ge: GeItem[]; geIssues: GeIssues; onAddGe: () => void; onRemoveGe: (g: GeItem) => void; onShowCourse: (id: string) => void;
}) {
  const units = quarter.units + ge.reduce((sum, g) => sum + (g.facts?.units ?? 0), 0);
  const open = Math.max(0, FULL_LOAD - units);
  const anySelected = roleOf("\0") !== null; // any course selected: GEs dim like other unrelated courses
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{quarter.label}</h3>
        <span className="text-xs tabular-nums text-muted">{units} units</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-background" aria-hidden>
        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (units / FULL_LOAD) * 100)}%` }} />
      </div>
      <ul className="mt-3 flex-1 space-y-1.5">
        {quarter.items.map((item) => (
          <li key={item.id}><CourseChip item={item} lookup={lookup} role={roleOf(item.id)} onSelect={onSelect} /></li>
        ))}
        {ge.map((g) => (
          <li key={g.id}>
            <GeChip item={g} issues={geIssues(g)} dimmed={anySelected} onRemove={() => onRemoveGe(g)} onShowCourse={onShowCourse} />
          </li>
        ))}
      </ul>
      <button type="button" onClick={onAddGe} className="mt-2 rounded-md py-1 text-left text-xs text-brand hover:underline">
        + Add a GE{open > 0 && <span className="text-muted"> · {open} units open</span>}
      </button>
    </div>
  );
}

function GeChip({ item, issues, dimmed, onRemove, onShowCourse }: {
  item: GeItem; issues: ReturnType<GeIssues>; dimmed: boolean; onRemove: () => void; onShowCourse: (id: string) => void;
}) {
  const numerals = (item.facts?.ge ?? []).map((g) => GE_CATEGORIES.find((c) => c.code === g)?.numeral ?? g).join(", ");
  const missing = issues?.missing ?? [];
  const restricted = issues && (issues.restriction.kind === "blocked" || issues.restriction.kind === "priority");
  const code = item.facts?.code ?? item.id;
  return (
    <div className={`flex items-start gap-1 rounded-lg border border-border border-l-4 border-l-emerald-500 bg-emerald-500/10 px-2.5 py-1.5 ${dimmed ? "opacity-35" : ""}`}>
      <div className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <a
            href={catalogueUrl(code)}
            target="_blank"
            rel="noreferrer"
            className={`font-mono text-xs font-semibold hover:text-brand ${missing.length || restricted ? "underline decoration-red-500 decoration-2 underline-offset-2" : "hover:underline"}`}
          >
            {code}
          </a>
          <span className="text-[11px] tabular-nums text-muted">{item.facts ? `${item.facts.units}u` : ""}</span>
        </span>
        <span className="block truncate text-xs text-muted">{item.facts ? `GE ${numerals} · ${item.facts.title}` : "Loading…"}</span>
        {missing.length > 0 && (
          <span className="mt-0.5 block text-[11px] text-red-600 dark:text-red-400">
            Requires{" "}
            {missing.map((m, i) => (
              <span key={m.kind === "course" ? m.id : m.kind === "exam" ? m.name : m.text}>
                {i > 0 && ", "}
                {m.kind === "course"
                  ? <button type="button" onClick={() => onShowCourse(m.id)} className="font-mono underline underline-offset-2">{m.code}</button>
                  : m.kind === "exam" ? m.name : m.text}
              </span>
            ))}{" "}
            first
          </span>
        )}
        {restricted && (
          <button type="button" onClick={() => onShowCourse(item.id)} className="mt-0.5 block text-left text-[11px] text-red-600 underline underline-offset-2 dark:text-red-400">
            {issues!.restriction.kind === "blocked" ? "Restricted enrollment" : "Enrollment priority to others"}
          </button>
        )}
      </div>
      <button type="button" onClick={onRemove} aria-label={`Remove ${code}`} className="-mr-1 grid size-5 shrink-0 place-items-center rounded text-muted hover:bg-background hover:text-foreground">×</button>
    </div>
  );
}

const roleStyles: Record<Exclude<Role, null>, string> = {
  selected: "ring-2 ring-brand",
  requires: "ring-2 ring-gold",
  unlocks: "ring-2 ring-brand/50",
  dimmed: "opacity-35",
};

function CourseChip({ item, lookup, role, onSelect }: { item: PlannedItem; lookup: Lookup; role: Role; onSelect: (id: string) => void }) {
  const code = item.placeholder ? "Elective" : lookup.courses.get(baseId(item.id))?.code ?? item.id;
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

function CourseDetails({ item, lookup, quarter, items, dependents, onSelect, onMarkTaken, onClose }: {
  item: PlannedItem; lookup: Lookup; quarter?: string; items: Map<string, PlannedItem>; dependents: string[];
  onSelect: (id: string) => void; onMarkTaken: (id: string) => void; onClose: () => void;
}) {
  const course = lookup.courses.get(baseId(item.id));
  const details = lookup.details[baseId(item.id)];
  const seasons = (["Fall", "Winter", "Spring"] as const).filter((s) => course?.terms.some((t) => t.endsWith(` ${s}`)));
  const codeOf = (id: string) => lookup.courses.get(baseId(id))?.code ?? id;
  const links = (ids: string[]) => ids.filter((id) => items.has(id)).map((id) => (
    <button key={id} type="button" onClick={() => onSelect(id)} className="rounded-md bg-background px-2 py-0.5 font-mono text-xs hover:text-brand">{codeOf(id)}</button>
  ));
  const requires = [...item.prereqs, ...item.coreqs];

  return (
    <div className="rounded-xl border border-border bg-surface p-5 text-sm" role="region" aria-label="Course details">
      <div className="flex items-start justify-between gap-3">
        <div>
          {item.placeholder
            ? <p className="font-mono text-xs font-semibold text-brand">Elective slot</p>
            : <a href={catalogueUrl(codeOf(item.id))} target="_blank" rel="noreferrer" className="font-mono text-xs font-semibold text-brand hover:underline">{codeOf(item.id)} ↗</a>}
          <h3 className="mt-0.5 text-base font-semibold">
            {item.placeholder ? item.title : <a href={catalogueUrl(codeOf(item.id))} target="_blank" rel="noreferrer" className="hover:text-brand hover:underline">{item.title}</a>}
          </h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-md px-2 text-lg leading-none text-muted hover:text-foreground">×</button>
      </div>

      <dl className="mt-4 space-y-3">
        <Row label="Why it's here">{item.reason}</Row>
        <Row label="When">{quarter ?? "Not scheduled"} · {item.units} units</Row>
        {course && <Row label="Usually offered">{seasons.length ? seasons.join(", ") : "No recent offering data"}</Row>}
        {requires.length > 0 && <Row label="Requires"><span className="flex flex-wrap gap-1">{links(requires)}</span></Row>}
        {dependents.length > 0 && <Row label="Unlocks"><span className="flex flex-wrap gap-1">{links(dependents)}</span></Row>}
        {details?.prerequisiteText && <Row label="Catalog prerequisites"><span className="text-muted">{details.prerequisiteText}</span></Row>}
        {item.placeholder && <Row label="What to do">Pick a course from your department&apos;s approved list for this requirement.</Row>}
      </dl>

      {!item.placeholder && (
        <button type="button" onClick={() => onMarkTaken(item.id)} className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-brand hover:text-brand">
          ✓ Mark as taken{requires.length > 0 && " (with its prerequisites)"}
        </button>
      )}

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
