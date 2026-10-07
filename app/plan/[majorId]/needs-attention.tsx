"use client";

import type { GeProgress } from "@/lib/ge";
import { recommendGes } from "@/lib/ge-recommend";
import type { Quarter } from "@/lib/planner";
import type { StudentState } from "@/lib/prereq-status";
import type { Standing } from "@/lib/restrictions";
import { GeRow } from "./ge-picker";
import type { GeCourses } from "./use-course-index";

// The GEs this student still needs, as a short list of courses they can take next quarter.
export function NeedsAttention({ quarter, geCourses, progress, student, standing, openUnits, exclude, liveTerm, onAdd, onMore, onShowCourse }: {
  quarter: Quarter;
  geCourses: GeCourses | null;
  progress: GeProgress;
  student: StudentState;
  standing: Standing;
  openUnits: number;
  exclude: Set<string>;
  liveTerm: string | null;
  onAdd: (id: string) => void;
  onMore: () => void;
  onShowCourse: (id: string) => void;
}) {
  const scheduleTerm = liveTerm === quarter.label ? liveTerm : null;
  const pool = geCourses ? [...geCourses.values()].filter((c) => !scheduleTerm || c.live?.term === scheduleTerm) : [];
  const recs = geCourses
    ? recommendGes({ candidates: scheduleTerm ? pool.map((c) => ({ ...c, seasons: "*" })) : pool, progress, season: quarter.season, student, standing, exclude, openUnits, limit: 4 })
        .filter((r) => r.missing.length === 0)
    : [];

  return (
    <section aria-labelledby="attention" className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border p-4">
        <div>
          <h2 id="attention" className="text-base font-semibold">GEs that still need attention</h2>
          <p className="mt-0.5 text-sm text-muted">
            {openUnits > 0 ? `You have room for about ${openUnits} more units in ${quarter.label}. ` : `${quarter.label} is already full, but you can swap one in. `}
            These fill GE categories you haven&apos;t covered, and you can take them then.
          </p>
        </div>
        <button type="button" onClick={onMore} className="text-sm font-medium text-brand hover:underline">All GE options →</button>
      </div>
      <ul className="divide-y divide-border">
        {!geCourses && <li className="p-4 text-sm text-muted">Finding GEs for you…</li>}
        {geCourses && recs.length === 0 && <li className="p-4 text-sm text-muted">Your GE categories are covered by courses you&apos;ve taken or planned. 🎉</li>}
        {recs.map((r) => (
          <GeRow
            key={r.course.id}
            course={geCourses?.get(r.course.id) ?? r.course}
            hasTree={!!r.course.prerequisiteTree || !!r.course.prerequisiteText}
            missing={r.missing}
            restriction={r.restriction}
            reasons={r.reasons}
            highlight={r.fills}
            scheduleTerm={scheduleTerm}
            onAdd={onAdd}
            onShowCourse={onShowCourse}
          />
        ))}
      </ul>
    </section>
  );
}
