"use client";

import { useEffect, useRef, useState } from "react";
import type { PrereqTree } from "@/db/schema";
import { catalogueUrl } from "@/lib/links";
import { courseStatus, type StudentState } from "@/lib/prereq-status";

type ApiCourse = {
  id: string;
  department: string;
  courseNumber: string;
  title: string;
  minUnits: number;
  maxUnits: number;
  description: string;
  prerequisiteText: string;
  prerequisiteTree: PrereqTree | Record<string, never>;
  restriction: string;
  terms: string[];
};

// Fetched straight from the Anteater API (it allows browser requests), so any course works,
// including ones that aren't in this major's data.
const cache = new Map<string, Promise<ApiCourse | null>>();
function fetchCourse(id: string) {
  if (!cache.has(id))
    cache.set(id, fetch(`https://anteaterapi.com/v2/rest/courses/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((body) => (body?.ok ? (body.data as ApiCourse) : null))
      .catch(() => {
        cache.delete(id);
        return null;
      }));
  return cache.get(id)!;
}

const recentSeasons = (terms: string[]) => {
  const since = new Date().getFullYear() - 4;
  return ["Fall", "Winter", "Spring"].filter((s) => terms.some((t) => t.endsWith(` ${s}`) && Number(t.slice(0, 4)) >= since));
};

// A modal that explains one course and what it requires. Clicking a missing prerequisite opens
// that course in the same modal, with Back to return.
export function CoursePopover({ courseId, student, isTaken, onMarkTaken, onClose }: {
  courseId: string;
  student: StudentState;
  isTaken: (id: string) => boolean;
  onMarkTaken: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [stack, setStack] = useState([courseId]);
  const current = stack.at(-1)!;
  const [loaded, setLoaded] = useState<{ id: string; course: ApiCourse | null } | null>(null);
  const course = loaded?.id === current ? loaded.course : undefined; // undefined = loading

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCourse(current).then((c) => !cancelled && setLoaded({ id: current, course: c }));
    return () => {
      cancelled = true;
    };
  }, [current]);

  const tree = course && Object.keys(course.prerequisiteTree ?? {}).length ? (course.prerequisiteTree as PrereqTree) : null;
  const status = courseStatus({ prerequisiteTree: tree, prerequisiteText: course?.prerequisiteText }, student);
  const hasPrereqs = !!tree || !!course?.prerequisiteText;
  const code = course ? `${course.department} ${course.courseNumber}` : current;
  const taken = isTaken(current);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-label={`About ${code}`}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-surface p-5 text-sm text-foreground shadow-2xl backdrop:bg-black/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {stack.length > 1 && (
            <button type="button" onClick={() => setStack((s) => s.slice(0, -1))} className="mb-1 text-xs text-muted hover:text-brand">← Back to {stack.at(-2)}</button>
          )}
          <a href={catalogueUrl(code)} target="_blank" rel="noreferrer" className="font-mono text-xs font-semibold text-brand hover:underline">{code} ↗</a>
          <h2 className="mt-0.5 text-base font-semibold">{course?.title ?? (course === null ? "Course not found" : "Loading…")}</h2>
        </div>
        <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded-md px-2 text-lg leading-none text-muted hover:text-foreground">×</button>
      </div>

      {course && (
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs font-medium text-muted">Units · usually offered</dt>
            <dd>{course.minUnits === course.maxUnits ? course.minUnits : `${course.minUnits}–${course.maxUnits}`} units · {recentSeasons(course.terms).join(", ") || "not offered recently"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Prerequisites</dt>
            <dd>
              {!hasPrereqs ? "None" : taken ? "You've taken this course." : status.met ? <span className="text-brand">✓ You&apos;ll have these done in time</span> : (
                <span className="flex flex-wrap items-center gap-1 text-red-600 dark:text-red-400">
                  You still need:
                  {status.missing.map((m) => m.kind === "course" ? (
                    <button key={m.id} type="button" onClick={() => setStack((s) => [...s, m.id])} className="rounded bg-red-500/10 px-1.5 font-mono text-xs underline decoration-red-500 underline-offset-2 hover:bg-red-500/20">{m.code}</button>
                  ) : (
                    <span key={m.kind === "exam" ? m.name : m.text} className="rounded bg-red-500/10 px-1.5 text-xs">{m.kind === "exam" ? m.name : m.text}</span>
                  ))}
                </span>
              )}
              {course.prerequisiteText && <p className="mt-1 text-xs text-muted">Catalogue: {course.prerequisiteText}</p>}
            </dd>
          </div>
          {course.restriction && (
            <div>
              <dt className="text-xs font-medium text-muted">Enrollment restriction</dt>
              <dd className="text-red-600 dark:text-red-400">{course.restriction}</dd>
            </div>
          )}
          {course.description && <p className="border-t border-border pt-3 text-muted">{course.description}</p>}
        </dl>
      )}

      {course && !taken && (
        <button type="button" onClick={() => onMarkTaken(current)} className="mt-4 w-full rounded-lg border border-border px-3 py-2 font-medium hover:border-brand hover:text-brand">
          ✓ I&apos;ve already taken {code}
        </button>
      )}
    </dialog>
  );
}
