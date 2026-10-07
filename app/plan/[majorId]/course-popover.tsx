"use client";

import { useEffect, useRef, useState } from "react";
import type { PrereqTree } from "@/db/schema";
import { catalogueUrl } from "@/lib/links";
import { courseStatus, type StudentState } from "@/lib/prereq-status";
import { MissingList } from "./missing-list";

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
type WebsocSection = { sectionCode: string; sectionType: string; status: string; maxCapacity: string; numCurrentlyEnrolled: { totalEnrolled: string }; instructors: string[]; meetings: { timeIsTBA: boolean; days?: string; startTime?: { hour: number; minute: number }; endTime?: { hour: number; minute: number } }[] };

// This quarter's sections, straight from UCI's Schedule of Classes via the Anteater API.
const sectionCache = new Map<string, Promise<WebsocSection[]>>();
function fetchSections(term: string, department: string, courseNumber: string) {
  const key = `${term}|${department}|${courseNumber}`;
  if (!sectionCache.has(key)) {
    const [quarter, year] = term.split(" "); // "Fall 2026"
    const url = `https://anteaterapi.com/v2/rest/websoc?year=${year}&quarter=${quarter}&department=${encodeURIComponent(department)}&courseNumber=${encodeURIComponent(courseNumber)}`;
    sectionCache.set(key, fetch(url).then((r) => r.json()).then((body) =>
      body?.ok ? body.data.schools.flatMap((s: { departments: { courses: { sections: WebsocSection[] }[] }[] }) => s.departments.flatMap((d) => d.courses.flatMap((c) => c.sections))) : [],
    ).catch(() => {
      sectionCache.delete(key);
      return [];
    }));
  }
  return sectionCache.get(key)!;
}

const clock = (t?: { hour: number; minute: number }) => (t ? `${t.hour > 12 ? t.hour - 12 : t.hour}:${String(t.minute).padStart(2, "0")}${t.hour >= 12 ? "pm" : "am"}` : "");

export function CoursePopover({ courseId, liveTerm, student, isTaken, onMarkTaken, onClose }: {
  courseId: string;
  liveTerm: string | null;
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
  const [sections, setSections] = useState<{ id: string; list: WebsocSection[] } | null>(null);

  useEffect(() => {
    if (!course || !liveTerm) return;
    let cancelled = false;
    fetchSections(liveTerm, course.department, course.courseNumber).then((list) => !cancelled && setSections({ id: course.id, list }));
    return () => {
      cancelled = true;
    };
  }, [course, liveTerm]);
  const liveSections = sections?.id === course?.id ? sections?.list : undefined;

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
                  You still need: <MissingList missing={status.missing} onShowCourse={(id) => setStack((st) => [...st, id])} />
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
          {liveTerm && (
            <div>
              <dt className="text-xs font-medium text-muted">{liveTerm} sections (live from UCI&apos;s Schedule of Classes)</dt>
              <dd className="mt-1">
                {liveSections === undefined ? <span className="text-xs text-muted">Loading…</span> : liveSections.length === 0 ? <span className="text-xs text-muted">Not offered in {liveTerm}.</span> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-muted"><tr><th className="py-1 pr-2 font-medium">Type</th><th className="pr-2 font-medium">Code</th><th className="pr-2 font-medium">When</th><th className="pr-2 font-medium">Instructor</th><th className="font-medium">Seats</th></tr></thead>
                      <tbody>
                        {liveSections.slice(0, 12).map((s) => {
                          const m = s.meetings.find((x) => !x.timeIsTBA);
                          const left = Math.max(0, Number(s.maxCapacity) - Number(s.numCurrentlyEnrolled.totalEnrolled || 0));
                          return (
                            <tr key={s.sectionCode} className="border-t border-border">
                              <td className="py-1 pr-2">{s.sectionType}</td>
                              <td className="pr-2 font-mono">{s.sectionCode}</td>
                              <td className="pr-2">{m ? `${m.days} ${clock(m.startTime)}–${clock(m.endTime)}` : "TBA"}</td>
                              <td className="pr-2">{s.instructors.filter((i) => i !== "STAFF").join(", ") || "Staff"}</td>
                              <td className={s.status === "OPEN" ? "text-emerald-600 dark:text-emerald-400" : s.status === "FULL" ? "text-red-600 dark:text-red-400" : "text-warn-ink"}>{s.status === "OPEN" ? `${left} open` : s.status}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-1 text-[11px] text-muted">Use the 5-digit code to enroll in WebReg.</p>
                  </div>
                )}
              </dd>
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
