"use client";

import { useState } from "react";
import { checkAddition, type AddIssue } from "@/lib/add-check";
import { chooseSections, conflicts, toBlocks, type Block } from "@/lib/calendar";
import { offeredIn, type IndexCourse } from "@/lib/course-index";
import type { GeCandidate } from "@/lib/ge-recommend";
import type { Season } from "@/lib/planner";
import type { StudentState } from "@/lib/prereq-status";
import type { Standing } from "@/lib/restrictions";
import { fetchSections } from "@/lib/websoc";
import { CourseSearch } from "./course-search";
import { MissingList } from "./missing-list";
import type { CourseIndex } from "./use-course-index";

type Pending = { course: IndexCourse; issues: AddIssue[] | null };

// Search any course to add to the quarter. It's checked first (offered then? prerequisites done?
// restricted? time conflict? too many units?); if it all works it's added to the calendar and the
// plan, otherwise the problems are shown and the student decides.
export function CalendarSearch({ quarterLabel, season, postedTerm, timesTerm, index, onSearchFocus, detailsOf, student, standing, owned, unitsPlanned, maxUnits, blocks, onAdd, onShowCourse }: {
  quarterLabel: string;
  season: Season;
  postedTerm: string | null; // this quarter's Schedule of Classes, if UCI has posted it
  timesTerm: string | null; // the term whose times the calendar shows (posted, or a preview)
  index: CourseIndex | null;
  onSearchFocus: () => void;
  detailsOf: (id: string) => GeCandidate | null;
  student: StudentState;
  standing: Standing;
  owned: Set<string>;
  unitsPlanned: number;
  maxUnits: number;
  blocks: Block[]; // classes already on the calendar
  onAdd: (id: string) => void;
  onShowCourse: (id: string) => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const check = async (course: IndexCourse) => {
    setAdded(null);
    setPending({ course, issues: null });
    const sections = timesTerm ? await fetchSections(timesTerm, course.code) : [];
    const offered = postedTerm ? sections.length > 0 : course.seasons === "" ? false : offeredIn(course, season);
    const issues = checkAddition({
      course, details: detailsOf(course.id), quarterLabel, offered, scheduleKnown: !!postedTerm,
      student, standing, owned, unitsPlanned, maxUnits,
    });
    // Time conflicts with the classes already on the calendar (using the most open sections).
    if (sections.length) {
      const mine = toBlocks(course.id, course.code, chooseSections(sections, new Set()));
      const clash = conflicts([...blocks, ...mine]).filter(([a, b]) => (a.courseId === course.id) !== (b.courseId === course.id));
      if (clash.length) {
        const other = clash.map(([a, b]) => (a.courseId === course.id ? b : a));
        issues.push({ kind: "conflict", message: `Its most open sections overlap ${[...new Set(other.map((o) => `${o.label} ${o.section.type}`))].join(", ")}. You may be able to pick other sections after adding it.` });
      }
    }
    if (issues.length) setPending({ course, issues });
    else {
      onAdd(course.id);
      setPending(null);
      setAdded(course.code);
    }
  };

  const confirm = () => {
    if (!pending) return;
    onAdd(pending.course.id);
    setAdded(pending.course.code);
    setPending(null);
  };

  return (
    <div className="border-b border-border px-4 pb-4">
      <label className="text-xs font-medium text-muted" htmlFor="cal-search">Add another class to {quarterLabel}</label>
      <div className="mt-1" id="cal-search">
        <CourseSearch index={index} onFocus={onSearchFocus} onPick={check} placeholder="Search by name or code, e.g. psychology or MUSIC 14" />
      </div>
      <div role="status" aria-live="polite">
        {added && <p className="mt-2 text-sm font-medium text-emerald-700">✓ Added {added} to {quarterLabel}. It&apos;s on your calendar and in your plan.</p>}
        {pending && pending.issues === null && <p className="mt-2 text-sm text-muted">Checking {pending.course.code}…</p>}
      </div>
      {pending?.issues && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm">
          <p className="font-medium text-red-700">
            {pending.course.code} · {pending.course.title} may not work for {quarterLabel}:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-red-700">
            {pending.issues.map((issue, i) => (
              <li key={i}>
                {issue.message}
                {issue.kind === "prereqs" && <> Needs <MissingList missing={issue.missing} onShowCourse={onShowCourse} /> first.</>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setPending(null)} className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:brightness-110">Don&apos;t add</button>
            <button type="button" onClick={confirm} className="rounded-lg border border-border px-3 py-1.5 hover:border-red-500 hover:text-red-700">Add anyway</button>
          </div>
        </div>
      )}
    </div>
  );
}
