"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fillElectives, planGes } from "@/lib/auto-plan";
import type { PlanPage, PlannerCourse } from "@/lib/data";
import { isUndeclared } from "@/lib/majors";
import { GE_CATEGORIES, geProgress, UNITS_TO_GRADUATE, type GeCourse } from "@/lib/ge";
import { buildPlan, SEASONS, type PlannedItem, type Quarter } from "@/lib/planner";
import { applyApCredit } from "@/lib/planner/ap";
import { unitsOf } from "@/lib/planner/select";
import { GePanel } from "./ge-panel";
import { catalogueUrl } from "@/lib/links";
import { courseStatus, type Missing, type StudentState } from "@/lib/prereq-status";
import { checkRestriction, type RestrictionCheck } from "@/lib/restrictions";
import { AddCourseDialog } from "./add-course-dialog";
import { CoursePopover } from "./course-popover";
import { GePicker } from "./ge-picker";
import { NextQuarter, type NextCourse } from "./next-quarter";
import { SetupFlow } from "./setup-flow";
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
const FULL_TIME = 12; // UCI's minimum units for full-time enrollment
const ELECTIVE_UNITS = 4;

export function PlanView({ major, courses: courseList, details, apExams, majors, entryYear, offeredSince }: PlanPage) {
  const router = useRouter();
  const undeclared = isUndeclared(major.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, update] = usePlanSettings(entryYear);
  const [picker, setPicker] = useState<{ quarter: number; category?: string } | null>(null);
  const [wantIndex, setWantIndex] = useState(false);
  const [popover, setPopover] = useState<{ id: string; quarter: number } | null>(null);
  const [courseDialog, setCourseDialog] = useState<number | null>(null); // quarter index
  const [autoNote, setAutoNote] = useState<string | null>(null);

  // The whole planner runs here in the browser (~20 ms), so every setting change is instant.
  // The React Compiler memoizes these, so they only recompute when their inputs change.
  const courses = new Map(courseList.map((c) => [c.id, c]));
  const credit = applyApCredit(apExams, settings.ap);

  // Courses outside this major (taken elsewhere, or added as GEs) need the full course index.
  const index = useCourseIndex(wantIndex || picker !== null || courseDialog !== null || settings.added.length > 0 || settings.taken.some((id) => !courses.has(id)));
  // Courses the student added (GEs or electives). Ones in quarters before the plan starts count as taken.
  // GE data is small (~25 KB), so load it up front for the GE tools.
  const geCourses = useGeCourses(true);
  // Facts about any course: this major's data first, then the GE data (always loaded), then the
  // full index (loaded on demand).
  const factsOf = (id: string): CourseFacts | null => {
    const c = courses.get(id);
    if (c) return { code: c.code, title: c.title, units: unitsOf(c), ge: c.ge };
    const g = geCourses?.get(id) ?? index?.get(id);
    return g ? { code: g.code, title: g.title, units: g.units, ge: g.ge } : null;
  };

  // Units each quarter already has from courses the student added, so major courses don't
  // overload it. A course whose data hasn't loaded yet counts as a typical 4 units.
  const reserved: Record<number, number> = {};
  for (const a of settings.added) reserved[a.quarter] = (reserved[a.quarter] ?? 0) + (factsOf(a.id)?.units ?? 4);
  const plan = buildPlan(major.requirements, courses, {
    startYear: settings.entryYear,
    firstQuarter: settings.firstQuarter,
    maxUnitsPerQuarter: settings.maxUnits,
    reserved,
    completed: [...settings.taken, ...credit.completed],
    exams: credit.exams,
    offeredSince,
  });
  const lookup: Lookup = { courses, details };
  const geItems: GeItem[] = settings.added.map((g) => ({ ...g, facts: factsOf(g.id) }));
  const geByQuarter = new Map<number, GeItem[]>();
  for (const g of geItems) if (g.quarter >= settings.firstQuarter) geByQuarter.set(g.quarter, [...(geByQuarter.get(g.quarter) ?? []), g]);
  const removeGe = (g: GeItem) => update({ added: settings.added.filter((x) => !(x.id === g.id && x.quarter === g.quarter)) });

  // Units toward the 180 needed to graduate.
  const doneIds = [...settings.taken, ...geItems.filter((g) => g.quarter < settings.firstQuarter).map((g) => g.id)];
  const unknownUnits = doneIds.some((id) => !factsOf(id));
  // Students who've been at UCI a while rarely enter every course, so they can state their total;
  // use whichever is larger.
  const unitsDone = Math.max(settings.unitsDone, doneIds.reduce((sum, id) => sum + (factsOf(id)?.units ?? 0), 0) + credit.units);
  const unitsNeeded = Math.max(0, UNITS_TO_GRADUATE - unitsDone);
  const quartersLeft = Math.max(1, PLAN_QUARTERS - settings.firstQuarter);

  const geKnown: GeCourse[] = [
    ...[...doneIds, ...credit.completed].map((id): GeCourse => ({ id, ge: factsOf(id)?.ge ?? [], status: "done" })),
    ...plan.quarters.flatMap((q) => q.items).filter((i) => !i.placeholder).map((i): GeCourse => ({ id: baseId(i.id), ge: factsOf(baseId(i.id))?.ge ?? [], status: "planned" })),
    ...geItems.filter((g) => g.quarter >= settings.firstQuarter).map((g): GeCourse => ({ id: g.id, ge: g.facts?.ge ?? [], status: "planned" })),
  ];
  const ge = geProgress(geKnown, credit.ge);

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
  const addedUnits = (q: number) => (geByQuarter.get(q) ?? []).reduce((sum, g) => sum + (g.facts?.units ?? 0), 0);
  const planned = plan.quarters.filter((q) => q.index < PLAN_QUARTERS);

  // Major + GE + added courses rarely reach 180 units on their own. Show the gap, and optionally
  // fill it with free-elective slots in the lightest quarters.
  const unitsPlanned = plan.quarters.reduce((sum, q) => sum + q.units + addedUnits(q.index), 0);
  const gap = Math.max(0, UNITS_TO_GRADUATE - unitsDone - unitsPlanned);
  const electives = settings.fill ? fillElectives(planned.map((q) => ({ index: q.index, units: q.units + addedUnits(q.index) })), gap) : new Map<number, number>();
  const electiveUnits = [...electives.values()].reduce((a, b) => a + b, 0) * ELECTIVE_UNITS;
  const quarterUnits = (q: Quarter) => q.units + addedUnits(q.index) + (electives.get(q.index) ?? 0) * ELECTIVE_UNITS;
  const belowFullTime = planned.filter((q) => quarterUnits(q) < FULL_TIME).length;
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
      have: new Set([...settings.taken, ...credit.completed, ...earlier, ...settings.added.filter((g) => g.quarter < q).map((g) => g.id)]),
      sameQuarter: new Set([...(plan.quarters.find((x) => x.index === q)?.items.map((i) => baseId(i.id)) ?? []), ...settings.added.filter((g) => g.quarter === q).map((g) => g.id)]),
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
  // "Plan my GEs for me": the recommender, run quarter by quarter. Undeclared students have room
  // for more GEs per quarter since they have no major courses yet.
  const autoPlanGes = () => {
    if (!geCourses) return;
    const result = planGes({
      quarters: planned.map((q) => ({
        index: q.index,
        season: q.season,
        units: q.units + addedUnits(q.index),
        courseIds: [...q.items.map((i) => baseId(i.id)), ...settings.added.filter((a) => a.quarter === q.index).map((a) => a.id)],
      })),
      candidates: [...geCourses.values()],
      known: geKnown,
      apGe: credit.ge,
      have: new Set([...settings.taken, ...credit.completed, ...settings.added.filter((a) => a.quarter < settings.firstQuarter).map((a) => a.id)]),
      exams: examScores,
      majorName: major.name,
      perQuarter: undeclared ? 3 : 2,
      fullLoad: FULL_LOAD,
    });
    setAutoNote(result.length
      ? `Added ${result.length} GE course${result.length === 1 ? "" : "s"}. Remove any with ×, or use “Add a GE” to swap one.`
      : "Nothing to add: your GE categories are covered, or there's no room left in your quarters.");
    if (result.length) update({ added: [...settings.added, ...result] });
  };

  // The major's courses in their usual order with nothing marked done, for the setup checklist.
  const baseline = settings.setup
    ? buildPlan(major.requirements, courses, { startYear: settings.entryYear, offeredSince })
        .quarters.flatMap((q) => q.items.filter((i) => !i.placeholder && !i.id.includes("#")).map((item) => ({ item, quarter: q.index })))
    : [];
  const baselineItems = new Map(baseline.map((b) => [b.item.id, b.item]));
  const baselineRequires = (id: string) => {
    const seen = new Set<string>();
    const stack = [...(baselineItems.get(id)?.prereqs ?? [])];
    while (stack.length) {
      const x = stack.pop()!;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...(baselineItems.get(x)?.prereqs ?? []));
    }
    return [...seen];
  };

  // The first quarter of the plan: what to sign up for next.
  const nextQuarter = plan.quarters[0];
  const nextCourses: NextCourse[] = nextQuarter
    ? [
        ...nextQuarter.items.filter((i) => !i.placeholder).map((i): NextCourse => ({ id: i.id, code: factsOf(baseId(i.id))?.code ?? i.id, title: i.title, units: i.units, kind: i.reason.startsWith("Prerequisite") ? "prereq" : "major" })),
        ...(geByQuarter.get(nextQuarter.index) ?? []).map((g): NextCourse => ({ id: g.id, code: g.facts?.code ?? g.id, title: g.facts?.title ?? "", units: g.facts?.units ?? 4, kind: "added" })),
      ]
    : [];

  // Taking a course means its prerequisites were taken too.
  const markTaken = (id: string) => {
    const ids = [id, ...requiresOf(id)].map(baseId).filter((x) => courses.has(x));
    update({ taken: [...new Set([...settings.taken, ...ids])] });
    setSelectedId(null);
  };

  if (settings.setup) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight sm:text-3xl">{shortName(major.name)}</h1>
        <SetupFlow
          settings={settings}
          update={update}
          baseline={baseline}
          requiresOf={baselineRequires}
          apExams={apExams}
          index={index}
          onSearchFocus={() => setWantIndex(true)}
          factsOf={factsOf}
        />
      </div>
    );
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{shortName(major.name)}</h1>
          {major.catalogYear && (
            <p className="mt-1 text-sm text-muted">
              {undeclared ? "GE requirements" : "Requirements"} from the {major.catalogYear.slice(0, 4)}–{major.catalogYear.slice(4)} catalog
            </p>
          )}
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            {undeclared ? "Try a major:" : "Change major:"}
            <select
              value={major.id}
              // keep AP scores, courses taken and added courses when switching
              onChange={(e) => router.push(`/plan/${e.target.value}${window.location.search}`)}
              className="max-w-[16rem] rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground"
            >
              <option value="undeclared">Undeclared / exploring</option>
              {majors.map((m) => <option key={m.id} value={m.id}>{shortName(m.name)}{m.degreeType ? ` (${m.degreeType})` : ""}</option>)}
            </select>
          </label>
        </div>
        <dl className="flex gap-6 text-sm">
          <Stat label="Units completed" value={unknownUnits && !index ? "…" : unitsDone} />
          <Stat label="Units needed" value={unknownUnits && !index ? "…" : unitsNeeded} hint={`of ${UNITS_TO_GRADUATE} to graduate`} />
          <Stat label="Per quarter" value={unknownUnits && !index ? "…" : Math.ceil(unitsNeeded / quartersLeft)} hint={`over ${quartersLeft} quarters`} />
        </dl>
      </header>

      {nextQuarter && (
        <div className="mt-6">
          <NextQuarter label={nextQuarter.label} courses={nextCourses} isFirstYear={settings.firstQuarter < 3} onPlanGes={autoPlanGes} />
        </div>
      )}

      <div className="mt-4">
        <SettingsPanel
          settings={settings}
          update={update}
          defaultEntryYear={entryYear}
          factsOf={factsOf}
          index={index}
          onSearchFocus={() => setWantIndex(true)}
          apExams={apExams}
          onReset={() => update({ entryYear, firstQuarter: 0, maxUnits: 16, taken: [], ap: {}, added: [], fill: false, setup: 0, unitsDone: 0 })}
        />
      </div>

      {undeclared && (
        <div className="mt-4 rounded-xl border border-brand/40 bg-brand-soft p-4 text-sm">
          <p className="font-medium">Exploring before you declare?</p>
          <p className="mt-1 text-muted">
            GEs count toward every major, so they&apos;re the safest classes to take now. Add your AP scores and any classes you&apos;ve
            taken above, then press <span className="font-medium text-foreground">Plan my GEs for me</span>. When a major interests you,
            pick it from <span className="font-medium text-foreground">Try a major</span>: everything you entered carries over.
          </p>
        </div>
      )}

      <div className="mt-4">
        <GePanel progress={ge} onFind={findGe} onAutoPlan={autoPlanGes} autoReady={!!geCourses} note={autoNote} />
      </div>

      {plan.warnings.filter((w) => !(undeclared && w.includes("doesn't list any requirements"))).length > 0 && (
        <ul className="mt-6 space-y-1 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn-ink">
          {plan.warnings.filter((w) => !(undeclared && w.includes("doesn't list any requirements"))).map((w) => <li key={w}>⚠ {w}</li>)}
        </ul>
      )}

      {(gap > 0 || settings.fill || belowFullTime > 0) && !(unknownUnits && !index) && (
        <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            {settings.fill ? (
              <p>Added <span className="font-semibold">{electiveUnits} units</span> of free electives so your plan reaches {UNITS_TO_GRADUATE}. Use <span className="font-medium">Pick a course</span> on any slot to choose a real class.</p>
            ) : (
              <p>
                Your plan adds up to <span className="font-semibold">{unitsDone + unitsPlanned} of {UNITS_TO_GRADUATE} units</span>
                {gap > 0 && <>: <span className="font-semibold">{gap} units short</span>. Fill the rest with electives, a minor, or more GEs.</>}
              </p>
            )}
            {belowFullTime > 0 && (
              <p className="mt-1 text-xs text-warn-ink">{belowFullTime} quarter{belowFullTime === 1 ? " is" : "s are"} under {FULL_TIME} units, UCI&apos;s full-time minimum.</p>
            )}
          </div>
          {(gap > 0 || settings.fill) && (
            <button
              type="button"
              onClick={() => update({ fill: !settings.fill })}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${settings.fill ? "border border-border hover:border-brand hover:text-brand" : "bg-brand text-white hover:brightness-110"}`}
            >
              {settings.fill ? "Remove elective slots" : "Fill with electives"}
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <Legend className="border-l-brand bg-brand-soft" label="Major requirement" />
        <Legend className="border-l-gold bg-gold-soft" label="Prerequisite" />
        <Legend className="border-dashed border-muted" label="Elective slot" />
        <Legend className="border-l-emerald-500 bg-emerald-500/10" label="Course you added" />
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
                  : <QuarterCard key={q.index} quarter={q} units={quarterUnits(q)} electives={electives.get(q.index) ?? 0} lookup={lookup} roleOf={roleOf} onSelect={select} ge={geByQuarter.get(q.index) ?? []} geIssues={geIssues} onAddGe={() => setPicker({ quarter: q.index })} onAddCourse={() => setCourseDialog(q.index)} onRemoveGe={removeGe} onShowCourse={(id) => setPopover({ id, quarter: q.index })} />)}
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
          exclude={new Set([...settings.taken, ...credit.completed, ...settings.added.map((g) => g.id), ...[...items.keys()].map(baseId)])}
          onAdd={(id) => update({ added: [...settings.added, { id, quarter: picker.quarter }] })}
          onShowCourse={(id) => setPopover({ id, quarter: picker.quarter })}
          onClose={() => setPicker(null)}
        />
      )}

      {courseDialog !== null && plan.quarters.find((q) => q.index === courseDialog) && (
        <AddCourseDialog
          quarter={plan.quarters.find((q) => q.index === courseDialog)!}
          index={index}
          exclude={new Set([...settings.taken, ...credit.completed, ...settings.added.map((g) => g.id), ...[...items.keys()].map(baseId)])}
          onAdd={(id) => update({ added: [...settings.added, { id, quarter: courseDialog }] })}
          onShowCourse={(id) => setPopover({ id, quarter: courseDialog })}
          onClose={() => setCourseDialog(null)}
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

function QuarterCard({ quarter, units, electives, lookup, roleOf, onSelect, ge, geIssues, onAddGe, onAddCourse, onRemoveGe, onShowCourse }: {
  quarter: Quarter; units: number; electives: number; lookup: Lookup; roleOf: (id: string) => Role; onSelect: (id: string) => void;
  ge: GeItem[]; geIssues: GeIssues; onAddGe: () => void; onAddCourse: () => void; onRemoveGe: (g: GeItem) => void; onShowCourse: (id: string) => void;
}) {
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
        {Array.from({ length: electives }, (_, i) => (
          <li key={`elective-${i}`} className={`flex items-center justify-between gap-2 rounded-lg border border-dashed border-muted/60 px-2.5 py-1.5 ${anySelected ? "opacity-35" : ""}`}>
            <span className="min-w-0">
              <span className="block text-xs font-semibold">Free elective</span>
              <span className="block text-xs text-muted">Any course · {ELECTIVE_UNITS} units</span>
            </span>
            <button type="button" onClick={onAddCourse} className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs hover:border-brand hover:text-brand">Pick a course</button>
          </li>
        ))}
      </ul>
      {quarter.index < PLAN_QUARTERS && units < FULL_TIME && (
        <p className="mt-2 text-[11px] text-warn-ink">Under {FULL_TIME} units (full-time)</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <button type="button" onClick={onAddGe} className="text-brand hover:underline">+ GE</button>
        <button type="button" onClick={onAddCourse} className="text-brand hover:underline">+ Course</button>
        {open > 0 && <span className="text-muted">{open} units open</span>}
      </div>
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
        <span className="block truncate text-xs text-muted">{item.facts ? `${numerals ? `GE ${numerals}` : "Elective"} · ${item.facts.title}` : "Loading…"}</span>
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
