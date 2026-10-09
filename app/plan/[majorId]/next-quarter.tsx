"use client";

import type { LiveSummary } from "@/lib/ge-recommend";
import { catalogueUrl } from "@/lib/links";
import { LiveBadge } from "./live-badge";

// UCI's official enrollment pages (all on reg.uci.edu or orientation.uci.edu).
const LINKS = {
  enrollment: "https://www.reg.uci.edu/enrollment/",
  schedule: "https://www.reg.uci.edu/perl/WebSoc",
  webreg: "https://www.reg.uci.edu/registrar/soc/webreg.html",
  orientation: "https://orientation.uci.edu/",
  calendar: "https://www.reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html",
};

export type NextCourse = { id: string; code: string; title: string; units: number; kind: "major" | "prereq" | "added"; live?: LiveSummary };

export function NextQuarter({ label, courses, maxUnits, liveTerm, isFirstYear, onPlanGes, onExplore, onCalendar, onRemove }: {
  label: string;
  maxUnits: number;
  liveTerm: string | null;
  onCalendar: () => void;
  onRemove: (id: string) => void; // only for courses the student added
  courses: NextCourse[];
  isFirstYear: boolean;
  onPlanGes: () => void;
  onExplore: () => void;
}) {
  const units = courses.reduce((sum, c) => sum + c.units, 0);
  const posted = liveTerm === label; // UCI has published this quarter's Schedule of Classes
  return (
    <section aria-labelledby="next-q" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="next-q" className="text-base font-semibold">Your recommended {label} schedule</h2>
        <span className="text-xs text-muted">{units} units</span>
      </div>

      {units > maxUnits && (
        <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700">
          {units} units is over your {maxUnits}-unit limit. Remove a course, or raise the limit under Complete College Planner.
        </p>
      )}
      <p className="mt-1 text-xs text-muted">
        {posted
          ? <>Live seat counts from UCI&apos;s {label} Schedule of Classes, updated daily.</>
          : <>UCI hasn&apos;t posted the {label} Schedule of Classes yet (usually about 6 weeks before the quarter). Check back then for times and open seats.</>}
      </p>

      {courses.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id} className="min-w-0 rounded-lg bg-subtle px-3 py-2 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <a href={catalogueUrl(c.code)} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:text-brand hover:underline">
                  <span className="font-mono text-xs font-semibold">{c.code}</span> · {c.title}
                </a>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted">
                  {c.kind === "added" ? "Added" : c.kind === "prereq" ? "Prerequisite" : "Required"} · {c.units}u
                  {c.kind === "added" && (
                    <button type="button" onClick={() => onRemove(c.id)} aria-label={`Remove ${c.code}`} className="grid size-5 place-items-center rounded text-muted hover:bg-surface hover:text-foreground">×</button>
                  )}
                </span>
              </div>
              {posted && (
                <div className="mt-1">
                  {c.live ? <LiveBadge live={c.live} /> : <span className="text-[11px] font-medium text-red-600">Not on the {label} schedule. Check with your counselor or pick another course.</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Nothing planned yet for {label}.{" "}
          <button type="button" onClick={onPlanGes} className="font-medium text-brand underline">Plan my GEs for me</button>{" "}
          or use “+ GE” on that quarter below.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <button type="button" onClick={onCalendar} className="text-sm font-medium text-brand hover:underline">See it as a weekly calendar →</button>
        <button type="button" onClick={onExplore} className="text-sm font-medium text-brand hover:underline">Browse available GEs for {label} ↓</button>
      </div>

      <details className="mt-4 rounded-lg bg-brand-soft px-3 py-2 text-sm" open={isFirstYear}>
        <summary className="cursor-pointer font-medium">How do I actually sign up for classes at UCI?</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted">
          {isFirstYear && (
            <li><span className="text-foreground">Go to Orientation (SPOT).</span> New students get advising and enroll in their first classes there. <a className="text-brand underline" href={LINKS.orientation} target="_blank" rel="noreferrer">UCI Orientation ↗</a></li>
          )}
          <li><span className="text-foreground">Find your enrollment window.</span> Each student gets a date and time when they can start enrolling. <a className="text-brand underline" href={LINKS.enrollment} target="_blank" rel="noreferrer">Registrar: enrollment ↗</a></li>
          <li><span className="text-foreground">Look up sections</span> for the courses above (times, rooms, open seats) in the Schedule of Classes. Write down each section&apos;s 5-digit code. <a className="text-brand underline" href={LINKS.schedule} target="_blank" rel="noreferrer">Schedule of Classes ↗</a></li>
          <li><span className="text-foreground">Enroll in WebReg</span> when your window opens, using those codes. If a class is full, join its waitlist and pick a backup. <a className="text-brand underline" href={LINKS.webreg} target="_blank" rel="noreferrer">WebReg ↗</a></li>
          <li><span className="text-foreground">Check deadlines</span> for adding and dropping classes. <a className="text-brand underline" href={LINKS.calendar} target="_blank" rel="noreferrer">Academic calendar ↗</a></li>
          <li><span className="text-foreground">Confirm with your academic counselor.</span> This plan is a strong starting point, but your counselor has the final word.</li>
        </ol>
      </details>
    </section>
  );
}
