"use client";

import Link from "next/link";
import type { ApExam, CourseGrant } from "@/lib/planner/ap";
import type { PlannedItem } from "@/lib/planner";
import { Stepper } from "@/app/components/stepper";
import { ON_TIME, SETUP_STEPS, type PlanSettings } from "@/lib/plan-settings";
import { startHref } from "@/lib/questionnaire";
import { termAt } from "@/lib/planner/types";
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

export function SetupFlow({ majorId, planSearch, settings, update, baseline, requiresOf, apExams, index, onSearchFocus, factsOf }: {
  majorId: string;
  planSearch: string; // the plan's current settings as a query string
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
  // Steps 1-4 live on /start; go there with every answer filled in.
  const toStart = (n: number) =>
    startHref(n, { yr: Math.min(4, Math.floor(settings.firstQuarter / 3) + 1), t: termAt(settings.firstQuarter, settings.entryYear).label, major: majorId }, planSearch);
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
      <Stepper step={step} targetFor={(n) => (n <= 4 ? toStart(n) : () => update({ setup: n }))} />

      {step === SETUP_STEPS.courses && (
        <>
          <h2 id="setup-title" className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">Which courses have you already finished?</h2>
          <label className="mt-4 block text-sm font-medium">
            Where did you take them?
            <select defaultValue="uci" className="mt-1 block w-full max-w-sm rounded-lg border border-border bg-subtle px-2.5 py-2 text-sm">
              <option value="uci">UC Irvine</option>
              <option disabled>More colleges coming soon</option>
            </select>
          </label>
          <p className="mt-3 text-sm text-muted">
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
                    <button type="button" onClick={() => update({ taken: settings.taken.filter((t) => t !== id) })} aria-label={`Remove ${codeOf(id)}`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-subtle">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {settings.firstQuarter > 0 && (
            <div className="mt-6 rounded-lg bg-subtle p-3">
              <UnitsDoneInput value={settings.unitsDone} onChange={(units) => update({ unitsDone: units })} />
              <p className="mt-1 text-xs text-muted">Easier than checking every GE and elective you&apos;ve taken. Used to work out how many units you still need.</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => update({ setup: SETUP_STEPS.ap })} className="text-sm text-muted hover:text-brand">← Back</button>
            <button type="button" onClick={() => update({ setup: SETUP_STEPS.graduation })} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-white hover:brightness-110">
              Next: graduation →
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
                    className="rounded-lg border border-border bg-subtle px-2 py-1 text-sm sm:w-32"
                  >
                    <option value="">Didn&apos;t take</option>
                    {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>Score {s}</option>)}
                  </select>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Link href={toStart(4)} className="text-sm text-muted hover:text-brand">← Back</Link>
            <button type="button" onClick={() => update({ setup: SETUP_STEPS.courses })} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-white hover:brightness-110">
              Next: courses you&apos;ve taken →
            </button>
          </div>
        </>
      )}

      {step === SETUP_STEPS.graduation && <GraduationStep settings={settings} update={update} onDone={done} />}
    </section>
  );
}

// When to graduate: on time (end of year 4), early with summer classes, or later with lighter
// quarters. The only question with a Skip button: skipping means on time.
function GraduationStep({ settings, update, onDone }: { settings: PlanSettings; update: (c: Partial<PlanSettings>) => void; onDone: () => void }) {
  const label = (grad: number) => termAt(grad - 1, settings.entryYear).label; // the last quarter
  const left = (grad: number) => grad - settings.firstQuarter;
  const choice = settings.grad < ON_TIME ? "early" : settings.grad > ON_TIME ? "longer" : "on-time";
  const early = [11, 10, 9].filter((g) => left(g) >= 2);
  const option = (key: string, title: string, detail: string, onPick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={choice === key}
      onClick={onPick}
      className={`rounded-xl border px-4 py-3 text-left ${choice === key ? "border-brand bg-brand-soft ring-2 ring-brand/30" : "border-border bg-surface hover:border-brand"}`}
    >
      <span className="block font-medium">{title}</span>
      <span className="block text-sm text-muted">{detail}</span>
    </button>
  );
  const sub = (options: number[], extra: (g: number) => string) => (
    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Graduation quarter">
      {options.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={settings.grad === g}
          onClick={() => update({ grad: g, summer: g < ON_TIME })}
          className={`rounded-full border px-4 py-1.5 text-sm ${settings.grad === g ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
        >
          {label(g)} <span className="opacity-80">· {extra(g)}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <h2 id="setup-title" className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">When do you want to graduate?</h2>
      <p className="mt-1 text-sm text-muted">This sets how many classes go in each quarter. You can change it any time.</p>
      <div className="mt-5 grid gap-2" role="radiogroup" aria-label="Graduation goal">
        {option("on-time", "On time", `Graduate ${label(ON_TIME)}: ${left(ON_TIME)} quarters from now, a normal load each quarter.`, () => update({ grad: ON_TIME, summer: false }))}
        {early.length > 0 && option("early", "Early, with summer classes", "Heavier quarters plus summer sessions, so you finish sooner.", () => update({ grad: early[0], summer: true }))}
        {option("longer", "Taking longer is fine", "Lighter quarters, more time for work, research or a minor.", () => update({ grad: 15, summer: false }))}
      </div>
      {choice === "early" && sub(early, (g) => (ON_TIME - g === 3 ? "a year early" : `${ON_TIME - g} quarter${ON_TIME - g === 1 ? "" : "s"} early`))}
      {choice === "longer" && sub([13, 14, 15], (g) => (g - ON_TIME === 3 ? "one extra year" : `${g - ON_TIME} extra quarter${g - ON_TIME === 1 ? "" : "s"}`))}
      {choice === "early" && <p className="mt-3 text-xs text-muted">Summer sessions are added to your plan with courses UCI actually offers in summer. Check the warnings on your plan: some majors can&apos;t finish early.</p>}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => update({ setup: SETUP_STEPS.courses })} className="text-sm text-muted hover:text-brand">← Back</button>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { update({ grad: ON_TIME, summer: false }); onDone(); }} className="rounded-xl px-4 py-2.5 text-sm text-muted hover:text-foreground">
            Skip
          </button>
          <button type="button" onClick={onDone} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-white hover:brightness-110">
            See my plan →
          </button>
        </div>
      </div>
    </>
  );
}
