"use client";

import { useState } from "react";
import { exploreCourses, type ExploreFilters } from "@/lib/explore";
import { GE_CATALOGUE_URL, GE_CATEGORIES, type GeProgress } from "@/lib/ge";
import type { Season } from "@/lib/planner";
import type { StudentState } from "@/lib/prereq-status";
import type { Standing } from "@/lib/restrictions";
import { GeRow } from "./ge-picker";
import type { GeCourses } from "./use-course-index";

const PAGE = 40;
const numeral = (code: string) => GE_CATEGORIES.find((c) => c.code === code)?.numeral ?? code;

// Browse every undergraduate course for one quarter, with "Ready for me" on by default so a
// student only sees classes they can actually take then.
export function ExplorePanel({ quarters, courses, progress, studentBefore, standingIn, owned, onAdd, onShowCourse }: {
  quarters: { index: number; label: string; season: Season; units: number }[];
  courses: GeCourses | null;
  progress: GeProgress;
  studentBefore: (q: number) => StudentState;
  standingIn: (q: number) => Standing;
  owned: Set<string>;
  onAdd: (id: string, quarter: number) => void;
  onShowCourse: (id: string, quarter: number) => void;
}) {
  const [quarter, setQuarter] = useState(quarters[0]?.index ?? 0);
  const [filters, setFilters] = useState<ExploreFilters>({ kind: "all", geCategory: null, readyOnly: true, lowerDivisionOnly: false, noPriority: false, query: "" });
  const [shown, setShown] = useState(PAGE);
  const [added, setAdded] = useState<string | null>(null);
  const q = quarters.find((x) => x.index === quarter) ?? quarters[0];
  const set = (change: Partial<ExploreFilters>) => {
    setFilters((f) => ({ ...f, ...change }));
    setShown(PAGE);
  };

  const results = courses && q
    ? exploreCourses({ courses: courses.values(), season: q.season, student: studentBefore(q.index), standing: standingIn(q.index), owned, progress, filters })
    : [];

  const toggle = (label: string, key: "readyOnly" | "lowerDivisionOnly" | "noPriority", hint: string) => (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" checked={filters[key]} onChange={(e) => set({ [key]: e.target.checked })} className="mt-0.5 size-4 accent-[var(--brand)]" />
      <span>
        {label}
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );

  return (
    <section aria-labelledby="explore-title" className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border p-4">
        <h2 id="explore-title" className="text-base font-semibold">Explore UCI courses</h2>
        <p className="mt-0.5 text-sm text-muted">
          Every undergraduate course UCI has offered in the last four years. Names link to the UCI catalogue.{" "}
          <a href={GE_CATALOGUE_URL} target="_blank" rel="noreferrer" className="text-brand underline">GE requirements ↗</a>
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-muted">
            For which quarter?
            <select value={quarter} onChange={(e) => { setQuarter(Number(e.target.value)); setShown(PAGE); }} className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground">
              {quarters.map((x) => <option key={x.index} value={x.index}>{x.label} · {x.units} units planned</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Show
            <select
              value={filters.geCategory ?? filters.kind}
              onChange={(e) => {
                const v = e.target.value;
                set(v.startsWith("GE-") ? { kind: "ge", geCategory: v } : { kind: v as ExploreFilters["kind"], geCategory: null });
              }}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            >
              <option value="all">All courses</option>
              <option value="ge">GE courses</option>
              <option value="elective">Electives (not GE)</option>
              <optgroup label="One GE category">
                {GE_CATEGORIES.map((c) => {
                  const p = progress[c.code];
                  return <option key={c.code} value={c.code}>{c.numeral}. {c.name}{p.done + p.planned >= c.need ? " ✓" : ""}</option>;
                })}
              </optgroup>
            </select>
          </label>
          <label className="text-xs font-medium text-muted">
            Search
            <input type="search" value={filters.query} onChange={(e) => set({ query: e.target.value })} placeholder="e.g. psychology, MUSIC 14" className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground" />
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {toggle("Ready for me", "readyOnly", `Prerequisites done by ${q?.label ?? "then"}, no restrictions blocking you`)}
          {toggle("Lower-division only", "lowerDivisionOnly", "Courses numbered under 100, usually for years 1–2")}
          {toggle("Hide priority-limited", "noPriority", "Skip courses where other majors enroll first")}
        </div>
      </div>

      <p className="px-4 pt-3 text-xs text-muted" role="status">
        {!courses ? "Loading UCI courses…" : `${results.length} course${results.length === 1 ? "" : "s"} for ${q?.label}`}
        {added && <span className="ml-2 font-medium text-brand">✓ Added {added} to {q?.label}</span>}
      </p>
      <ul className="divide-y divide-border">
        {results.slice(0, shown).map((r) => (
          <GeRow
            key={r.course.id}
            course={r.course}
            hasTree={!!r.course.prerequisiteTree || !!r.course.prerequisiteText}
            missing={r.missing}
            restriction={r.restriction}
            highlight={r.fillsOpenGe}
            reasons={r.fillsOpenGe.length ? [`Fills GE ${r.fillsOpenGe.map(numeral).join(", ")} (still needed)`] : undefined}
            onAdd={(id) => { onAdd(id, quarter); setAdded(r.course.code); }}
            onShowCourse={(id) => onShowCourse(id, quarter)}
          />
        ))}
      </ul>
      {results.length > shown && (
        <div className="p-3 text-center">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="rounded-lg border border-border px-4 py-1.5 text-sm hover:border-brand hover:text-brand">
            Show more ({results.length - shown} left)
          </button>
        </div>
      )}
      {courses && results.length === 0 && (
        <p className="p-4 text-sm text-muted">No courses match. Try turning off a filter, or pick a different quarter.</p>
      )}
    </section>
  );
}
