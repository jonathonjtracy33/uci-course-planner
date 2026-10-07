"use client";

import { useEffect, useRef, useState } from "react";
import { GE_CATALOGUE_URL, GE_CATEGORIES, type GeProgress } from "@/lib/ge";
import { recommendGes, redundant, type GeCandidate, type Recommendation } from "@/lib/ge-recommend";
import { catalogueUrl } from "@/lib/links";
import type { Season } from "@/lib/planner";
import { courseStatus, type Missing, type StudentState } from "@/lib/prereq-status";
import { checkRestriction, type RestrictionCheck, type Standing } from "@/lib/restrictions";
import { LiveBadge } from "./live-badge";
import { MissingList } from "./missing-list";
import type { GeCourses } from "./use-course-index";

const LIMIT = 60;
const numeralOf = (code: string) => (code === "GE-5" ? "V" : GE_CATEGORIES.find((c) => c.code === code)?.numeral ?? code);

export function GePicker({ quarter, category, geCourses, progress, student, standing, openUnits, exclude, liveTerm, onAdd, onShowCourse, onClose }: {
  quarter: { label: string; season: Season };
  liveTerm: string | null;
  category?: string;
  geCourses: GeCourses | null;
  progress: GeProgress;
  student: StudentState; // what the student will have finished before this quarter
  standing: Standing; // their year and major in this quarter
  openUnits: number;
  exclude: Set<string>; // already taken or planned
  onAdd: (id: string) => void;
  onShowCourse: (id: string) => void; // opens the course's requirements popup
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstOpen = GE_CATEGORIES.find((c) => progress[c.code].done + progress[c.code].planned < c.need)?.code ?? "GE-2";
  const [selected, setSelected] = useState(category ?? firstOpen);
  const [mode, setMode] = useState<"browse" | "recommend">("browse");
  const [query, setQuery] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const add = (id: string) => {
    onAdd(id);
    dialog.current?.close();
  };

  // Once UCI posts this quarter's Schedule of Classes, only suggest courses that are on it.
  const scheduleTerm = liveTerm === quarter.label ? liveTerm : null;
  const pool = geCourses ? [...geCourses.values()].filter((c) => !scheduleTerm || c.live?.term === scheduleTerm) : [];
  const recommendations = mode === "recommend" && geCourses
    ? recommendGes({ candidates: scheduleTerm ? pool.map((c) => ({ ...c, seasons: "*" })) : pool, progress, season: quarter.season, student, standing, exclude, openUnits })
    : [];

  const owned = new Set([...exclude, ...student.have]);
  const usual = GE_CATEGORIES.find((c) => c.code === selected)?.usual ?? [];
  const rank = (id: string) => (usual.includes(id) ? usual.indexOf(id) : usual.length);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = geCourses && mode === "browse"
    ? pool
        .filter((c) => c.ge.includes(selected) && (scheduleTerm || c.seasons === "*" || c.seasons.includes(quarter.season[0])) && !exclude.has(c.id) && !redundant(c, owned))
        .filter((c) => words.every((w) => `${c.code} ${c.title}`.toLowerCase().includes(w)))
        .map((c) => ({ c, status: courseStatus(c, student), restriction: checkRestriction(c.restriction, standing) }))
        // the catalogue's standard choices first, then courses the student can take now, then
        // lower division, then ones that count toward more GE categories
        .sort((a, b) =>
          rank(a.c.id) - rank(b.c.id) ||
          Number(!a.status.met || a.restriction.kind === "blocked") - Number(!b.status.met || b.restriction.kind === "blocked") ||
          Number(a.c.number >= 100) - Number(b.c.number >= 100) ||
          b.c.ge.length - a.c.ge.length ||
          a.c.code.localeCompare(b.c.code))
    : [];
  const category_ = GE_CATEGORIES.find((c) => c.code === selected)!;
  const p = progress[selected];

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-labelledby="ge-picker-title"
      className="m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[88vh] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[88vh] flex-col">
        <header className="border-b border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="ge-picker-title" className="text-base font-semibold">Add a GE to {quarter.label}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {scheduleTerm
                  ? <>Approved GE courses on UCI&apos;s {quarter.label} Schedule of Classes, with live seats. </>
                  : <>Approved GE courses UCI has offered in {quarter.season} recently. </>}
                Click a course name for its UCI catalogue page.{" "}
                <a href={GE_CATALOGUE_URL} target="_blank" rel="noreferrer" className="text-brand underline">UCI GE requirements ↗</a>
              </p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded-md px-2 text-lg leading-none text-muted hover:text-foreground">×</button>
          </div>

          <button
            type="button"
            onClick={() => setMode((m) => (m === "recommend" ? "browse" : "recommend"))}
            aria-pressed={mode === "recommend"}
            className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium ${mode === "recommend" ? "border border-brand bg-brand-soft text-brand" : "bg-brand text-white hover:brightness-110"}`}
          >
            {mode === "recommend" ? "← Back to browsing by category" : "✨ Recommend GE courses"}
          </button>

          {mode === "browse" && (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="GE category">
                {GE_CATEGORIES.map((c) => {
                  const done = progress[c.code].done + progress[c.code].planned >= c.need;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      role="tab"
                      aria-selected={selected === c.code}
                      onClick={() => setSelected(c.code)}
                      className={`rounded-full border px-2.5 py-1 text-xs ${selected === c.code ? "border-brand bg-brand text-white" : "border-border hover:border-brand"}`}
                    >
                      {c.numeral}{done && " ✓"}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-sm">
                <span className="font-medium">{category_.numeral}. {category_.name}</span>{" "}
                <span className="text-muted">· {Math.min(p.done + p.planned, p.need)} of {p.need} {p.need === 1 ? "course" : "courses"}{category_.note && ` · ${category_.note}`}</span>
              </p>
              <input
                type="search"
                aria-label="Filter courses"
                placeholder="Filter by code or title…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </>
          )}
          {mode === "recommend" && (
            <p className="mt-3 text-xs text-muted">
              Picked for the GE categories you still need, counting what you&apos;ve taken and what&apos;s planned before {quarter.label}.
              Courses that fill several categories come first; ones you can&apos;t enroll in are left out.
            </p>
          )}
        </header>

        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {!geCourses && <li className="p-4 text-sm text-muted">Loading UCI&apos;s GE courses…</li>}

          {mode === "recommend" && geCourses && recommendations.length === 0 && (
            <li className="p-4 text-sm text-muted">Every GE category is covered by courses you&apos;ve taken or planned. 🎉</li>
          )}
          {recommendations.map((r: Recommendation) => (
            <GeRow key={r.course.id} course={geCourses?.get(r.course.id) ?? r.course} hasTree={!!r.course.prerequisiteTree || !!r.course.prerequisiteText} missing={r.missing} restriction={r.restriction} reasons={r.reasons} highlight={r.fills} scheduleTerm={scheduleTerm} onAdd={add} onShowCourse={onShowCourse} />
          ))}

          {mode === "browse" && geCourses && matches.length === 0 && (
            <li className="p-4 text-sm text-muted">No {category_.numeral} courses offered in {quarter.season} match.</li>
          )}
          {matches.slice(0, LIMIT).map(({ c, status, restriction }) => (
            <GeRow key={c.id} course={c} hasTree={!!c.prerequisiteTree || !!c.prerequisiteText} missing={status.missing} restriction={restriction} scheduleTerm={scheduleTerm} onAdd={add} onShowCourse={onShowCourse} />
          ))}
          {matches.length > LIMIT && <li className="p-3 text-center text-xs text-muted">Showing {LIMIT} of {matches.length}. Filter to narrow it down.</li>}
        </ul>
      </div>
    </dialog>
  );
}

// One course. Anything that could stop the student from taking it (a missing prerequisite or an
// enrollment restriction) underlines the name in red and says what to do about it.
export function GeRow({ course, hasTree, missing, restriction, reasons, highlight, scheduleTerm, onAdd, onShowCourse }: {
  course: GeCandidate;
  scheduleTerm?: string | null; // show this quarter's live Schedule of Classes status
  hasTree: boolean;
  missing: Missing[];
  restriction: RestrictionCheck;
  reasons?: string[];
  highlight?: string[];
  onAdd: (id: string) => void;
  onShowCourse: (id: string) => void;
}) {
  const limited = missing.length > 0 || restriction.kind === "blocked" || restriction.kind === "priority";
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">
          <a
            href={catalogueUrl(course.code)}
            target="_blank"
            rel="noreferrer"
            className={`hover:text-brand ${limited ? "underline decoration-red-500 decoration-2 underline-offset-4" : "hover:underline"}`}
          >
            <span className="font-mono text-xs font-semibold">{course.code}</span> · {course.title}
          </a>{" "}
          <span className="text-xs text-muted">· {course.units} units</span>
        </p>
        <p className="mt-1 flex flex-wrap gap-1">
          {course.ge.map((g) => (
            <span key={g} className={`rounded px-1.5 text-[10px] font-medium ${highlight?.includes(g) || (g.startsWith("GE-5") && highlight?.includes("GE-5")) ? "bg-brand text-white" : "bg-background text-muted"}`}>GE {numeralOf(g)}</span>
          ))}
        </p>

        {missing.length > 0 && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            Course requires <MissingList missing={missing} onShowCourse={onShowCourse} />{" "}
            first ·{" "}
            <button type="button" onClick={() => onShowCourse(course.id)} className="underline underline-offset-2">see all requirements</button>
          </p>
        )}
        {hasTree && missing.length === 0 && (
          <p className="mt-1 text-xs text-brand">
            ✓ Prerequisites met ·{" "}
            <button type="button" onClick={() => onShowCourse(course.id)} className="underline underline-offset-2">see requirements</button>
          </p>
        )}
        {restriction.kind === "blocked" && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Restricted: {restriction.text}</p>}
        {restriction.kind === "priority" && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Enrollment limit: {restriction.text}</p>}
        {reasons && <p className="mt-1 text-xs text-muted">{reasons.join(" · ")}</p>}
        {scheduleTerm && course.live?.term === scheduleTerm && <p className="mt-1"><LiveBadge live={course.live} /></p>}
      </div>
      <button type="button" onClick={() => onAdd(course.id)} className="shrink-0 rounded-lg border border-border px-3 py-1 text-sm hover:border-brand hover:text-brand">Add</button>
    </li>
  );
}
