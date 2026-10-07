"use client";

import type { ApExam, CourseGrant } from "@/lib/planner/ap";
import type { PlannedItem } from "@/lib/planner";
import { SETUP_STEPS, type PlanSettings } from "@/lib/plan-settings";
import { CourseSearch } from "./course-search";
import { UnitsDoneInput } from "./units-done-input";
import type { CourseFacts } from "./plan-view";
import type { CourseIndex } from "./use-course-index";

// The exams most incoming students have taken, shown first.
const COMMON_AP = [
  "AP Calculus AB", "AP Calculus BC", "AP English Language and Composition", "AP English Literature and Composition",
  "AP Statistics", "AP Biology", "AP Chemistry", "AP Physics 1: Algebra-Based", "AP Computer Science A", "AP Psychology",
  "AP United States History", "AP Spanish Language and Culture",
];

// UCI's grant rules as plain words: "MATH 2A and MATH 2B, or MATH 5A and MATH 5B",
// "MGMT 7 and one of STATS 7, STATS 8, SOCECOL 13".
function describe(g: CourseGrant, nested = false): string {
  if (typeof g === "string") return g;
  const list = "AND" in g ? g.AND : g.OR;
  if (!list.length) return "";
  const parts = list.map((x) => describe(x, true)).filter(Boolean);
  if ("AND" in g) return parts.join(" and ");
  if (parts.length > 2 || nested) return `one of ${parts.join(", ")}`;
  return parts.join(", or ");
}

// What one exam score earns: "MATH 2A and MATH 2B · 8 units · GE 5A".
function earns(exam: ApExam, score: number): string {
  const reward = exam.rewards.find((r) => r.scores.includes(score));
  if (!reward) return "No credit at this score";
  const ge = Object.keys(reward.ge).map((g) => g.replace("GE-", "GE "));
  const parts = [describe(reward.courses), reward.units ? `${reward.units} units` : null, ...ge].filter(Boolean);
  return parts.join(" · ");
}

export function SetupFlow({ settings, update, baseline, requiresOf, apExams, index, onSearchFocus, factsOf }: {
  settings: PlanSettings;
  update: (change: Partial<PlanSettings>) => void;
  baseline: { item: PlannedItem; quarter: number }[]; // the major's courses in usual order, before anything is marked done
  requiresOf: (id: string) => string[];
  apExams: ApExam[];
  index: CourseIndex | null;
  onSearchFocus: () => void;
  factsOf: (id: string) => CourseFacts | null;
}) {
  const step = settings.setup;
  const codeOf = (id: string) => factsOf(id)?.code ?? id;
  const taken = new Set(settings.taken);
  const done = () => {
    update({ setup: 0 });
    window.scrollTo({ top: 0 });
  };

  const toggle = (id: string) => {
    if (taken.has(id)) update({ taken: settings.taken.filter((t) => t !== id) });
    // Finishing a course means its prerequisites were finished too.
    else update({ taken: [...new Set([...settings.taken, id, ...requiresOf(id)])] });
  };

  const byYear = new Map<number, typeof baseline>();
  for (const b of baseline) {
    const y = Math.min(4, Math.floor(b.quarter / 3) + 1);
    byYear.set(y, [...(byYear.get(y) ?? []), b]);
  }
  const extraTaken = settings.taken.filter((id) => !baseline.some((b) => b.item.id === id));
  const commonFirst = [...apExams].sort((a, b) => {
    const ia = COMMON_AP.indexOf(a.name), ib = COMMON_AP.indexOf(b.name);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
  });

  return (
    <section className="rounded-2xl border border-brand/40 bg-surface p-5 shadow-sm sm:p-6" aria-labelledby="setup-title">
      <p className="text-sm font-medium text-brand">Step {step} of 4</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full rounded-full bg-brand" style={{ width: `${step * 25}%` }} />
      </div>

      {step === SETUP_STEPS.courses && (
        <>
          <h2 id="setup-title" className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">Which UCI courses have you already finished?</h2>
          <p className="mt-1 text-sm text-muted">
            Check everything you&apos;ve passed. Checking a course also checks the courses it requires. Haven&apos;t taken any yet? Just press Next.
          </p>

          {[...byYear].map(([year, list]) => (
            <fieldset key={year} className="mt-5">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted">Usually taken in year {year}</legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {list.map(({ item }) => (
                  <label key={item.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${taken.has(item.id) ? "border-brand bg-brand-soft" : "border-border hover:border-brand"}`}>
                    <input type="checkbox" checked={taken.has(item.id)} onChange={() => toggle(item.id)} className="mt-0.5 size-4 accent-[var(--brand)]" />
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-semibold">{codeOf(item.id)}</span>
                      <span className="block truncate text-xs text-muted">{item.title}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <div className="mt-6">
            <p className="text-sm font-medium">Other UCI courses you&apos;ve finished (GEs, electives, anything)</p>
            <div className="mt-2">
              <CourseSearch index={index} onFocus={onSearchFocus} onPick={(c) => update({ taken: [...new Set([...settings.taken, c.id])] })} placeholder="Search any UCI course, e.g. WRITING 50" />
            </div>
            {extraTaken.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {extraTaken.map((id) => (
                  <li key={id} className="flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pl-2.5 pr-1 text-xs">
                    <span className="font-mono">{codeOf(id)}</span>
                    <button type="button" onClick={() => update({ taken: settings.taken.filter((t) => t !== id) })} aria-label={`Remove ${codeOf(id)}`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-background">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {settings.firstQuarter > 0 && (
            <div className="mt-6 rounded-lg bg-background p-3">
              <UnitsDoneInput value={settings.unitsDone} onChange={(units) => update({ unitsDone: units })} />
              <p className="mt-1 text-xs text-muted">Easier than checking every GE and elective you&apos;ve taken. Used to work out how many units you still need.</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={done} className="text-sm text-muted hover:text-brand">Skip setup</button>
            <button type="button" onClick={() => update({ setup: SETUP_STEPS.ap })} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-white hover:brightness-110">
              Next: AP scores →
            </button>
          </div>
        </>
      )}

      {step === SETUP_STEPS.ap && (
        <>
          <h2 id="setup-title" className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">Did you take any AP exams?</h2>
          <p className="mt-1 text-sm text-muted">
            Pick your score for each exam you took. UCI&apos;s official AP credit rules decide what it&apos;s worth, so you may skip some classes.
          </p>
          <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
            {commonFirst.map((exam, i) => {
              const score = settings.ap[exam.name];
              return (
                <li key={exam.name} className={`flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between ${i === COMMON_AP.length ? "border-t-4 border-t-border" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{exam.name.replace(/^AP /, "")}</p>
                    {score !== undefined && <p className="text-xs text-brand">Earns: {earns(exam, score)}</p>}
                  </div>
                  <select
                    aria-label={`${exam.name} score`}
                    value={score ?? ""}
                    onChange={(e) => {
                      const next = { ...settings.ap };
                      if (e.target.value) next[exam.name] = Number(e.target.value);
                      else delete next[exam.name];
                      update({ ap: next });
                    }}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm sm:w-32"
                  >
                    <option value="">Didn&apos;t take</option>
                    {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>Score {s}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => update({ setup: SETUP_STEPS.courses })} className="text-sm text-muted hover:text-brand">← Back</button>
            <button type="button" onClick={done} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-white hover:brightness-110">
              See my plan →
            </button>
          </div>
        </>
      )}
    </section>
  );
}
