"use client";

import { useState } from "react";
import { availableGes, GE_SUBJECTS } from "@/lib/available-ges";
import { GE_CATALOGUE_URL, GE_CATEGORIES, type GeProgress } from "@/lib/ge";
import type { Quarter } from "@/lib/planner";
import type { StudentState } from "@/lib/prereq-status";
import type { Standing } from "@/lib/restrictions";
import { GeRow } from "./ge-picker";
import type { GeCourses } from "./use-course-index";

const PAGE = 12;
const numeral = (code: string) => (code === "GE-5" ? "V" : GE_CATEGORIES.find((c) => c.code === code)?.numeral ?? code);
const named = (code: string) => {
  const c = GE_CATEGORIES.find((x) => x.code === code);
  return c ? `GE ${c.numeral} (${c.name})` : code;
};
const list = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

// Classes the student could add to their upcoming quarter that count toward a GE, browsable by
// subject. Only classes they can take: offered (with open seats, once UCI posts the schedule),
// prerequisites done, and not restricted away from them.
export function AvailableGes({ quarter, geCourses, progress, student, standing, openUnits, owned, liveTerm, onAdd, onMore, onShowCourse }: {
  quarter: Quarter;
  geCourses: GeCourses | null;
  progress: GeProgress;
  student: StudentState;
  standing: Standing;
  openUnits: number;
  owned: Set<string>;
  liveTerm: string | null; // newest quarter on UCI's Schedule of Classes
  onAdd: (id: string) => void;
  onMore: () => void;
  onShowCourse: (id: string) => void;
}) {
  const [subject, setSubject] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [added, setAdded] = useState<string | null>(null);
  const scheduleTerm = liveTerm === quarter.label ? liveTerm : null;
  const { results, coveredInSubject } = geCourses
    ? availableGes({ courses: [...geCourses.values()], progress, season: quarter.season, student, standing, owned, scheduleTerm, subject, openUnits })
    : { results: [], coveredInSubject: [] };
  const subjectLabel = GE_SUBJECTS.find((s) => s.id === subject)?.label;
  const helping = results.filter((r) => r.fills.length > 0).length;

  const pick = (id: string | null) => {
    setSubject(id);
    setShown(PAGE);
  };
  const chip = (id: string | null, label: string) => (
    <button
      key={id ?? "best"}
      type="button"
      aria-pressed={subject === id}
      onClick={() => pick(id)}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm ${subject === id ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand hover:text-brand"}`}
    >
      {label}
    </button>
  );

  return (
    <section aria-labelledby="available-ges" className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="available-ges" className="text-base font-semibold">Available GEs</h2>
          <div className="flex gap-3 text-sm">
            <a href={GE_CATALOGUE_URL} target="_blank" rel="noreferrer" className="text-muted hover:text-brand">GE requirements ↗</a>
            <button type="button" onClick={onMore} className="font-medium text-brand hover:underline">All GE options →</button>
          </div>
        </div>
        <p className="mt-0.5 text-sm text-muted">
          {openUnits > 0 ? `You have room for about ${openUnits} more units in ${quarter.label}. ` : `${quarter.label} is already full, but you can swap one in. `}
          Pick a subject you like, or let us choose the classes that do the most for your GEs.
        </p>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap" role="toolbar" aria-label="Subject">
          {chip(null, "✨ Best for me")}
          {GE_SUBJECTS.map((s) => chip(s.id, s.label))}
        </div>
      </div>

      <p className={`mx-4 mt-3 rounded-lg px-3 py-2 text-xs ${scheduleTerm ? "bg-emerald-500/10 text-emerald-800" : "bg-subtle text-muted"}`}>
        {scheduleTerm
          ? <>Live from UCI&apos;s {scheduleTerm} Schedule of Classes: only classes with open seats. Updated nightly.</>
          : <>UCI hasn&apos;t posted the {quarter.label} Schedule of Classes yet (it usually comes out about 6 weeks before the quarter), so these are classes UCI usually offers in {quarter.season}. Open seats appear here automatically once it&apos;s posted.</>}
      </p>

      {subject && coveredInSubject.length > 0 && (
        <p role="note" className="mx-4 mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Heads up:</span> most {subjectLabel} classes count toward {list(coveredInSubject.map(named))}, which you&apos;ve already satisfied.
          {" "}They still count as units toward graduation{helping > 0 ? `, and the ${helping} listed first still add to a GE you need.` : ", but won't add GE progress."}
        </p>
      )}

      <p className="px-4 pt-3 text-xs text-muted" role="status">
        {!geCourses
          ? "Finding classes for you…"
          : subject
            ? `${results.length} ${subjectLabel} class${results.length === 1 ? "" : "es"} you can take in ${quarter.label}`
            : `Best GE picks for ${quarter.label}`}
        {added && <span className="ml-2 font-medium text-brand">✓ Added {added} to {quarter.label}</span>}
      </p>
      <ul className="divide-y divide-border">
        {results.slice(0, shown).map((r) => (
          <GeRow
            key={r.course.id}
            course={r.course}
            hasTree={!!r.course.prerequisiteTree || !!r.course.prerequisiteText}
            missing={r.missing}
            restriction={r.restriction}
            highlight={r.fills}
            reasons={r.fills.length
              ? [`Adds to GE ${r.fills.map(numeral).join(", ")}`, r.course.prerequisiteTree || r.course.prerequisiteText ? "You've met the prerequisites" : "No prerequisites"]
              : [`GE ${r.alreadyDone.map(numeral).join(", ")} already satisfied: counts as units only`]}
            scheduleTerm={scheduleTerm}
            onAdd={(id) => { onAdd(id); setAdded(r.course.code); }}
            onShowCourse={onShowCourse}
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
      {geCourses && results.length === 0 && (
        <p className="p-4 text-sm text-muted">
          {subject
            ? `No open ${subjectLabel} GE classes you can take in ${quarter.label} right now. Try another subject${scheduleTerm ? ", or check back: seats open up as students change schedules" : ""}.`
            : "Your GE categories are covered by classes you've taken or planned. 🎉"}
        </p>
      )}
    </section>
  );
}
