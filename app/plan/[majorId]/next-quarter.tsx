"use client";

import { catalogueUrl } from "@/lib/links";

// UCI's official enrollment pages (all on reg.uci.edu or orientation.uci.edu).
const LINKS = {
  enrollment: "https://www.reg.uci.edu/enrollment/",
  schedule: "https://www.reg.uci.edu/perl/WebSoc",
  webreg: "https://www.reg.uci.edu/registrar/soc/webreg.html",
  orientation: "https://orientation.uci.edu/",
  calendar: "https://www.reg.uci.edu/calendars/quarterly/2026-2027/quarterly26-27.html",
};

export type NextCourse = { id: string; code: string; title: string; units: number; kind: "major" | "prereq" | "added" };

export function NextQuarter({ label, courses, isFirstYear, onPlanGes, onExplore }: {
  label: string;
  courses: NextCourse[];
  isFirstYear: boolean;
  onPlanGes: () => void;
  onExplore: () => void;
}) {
  const units = courses.reduce((sum, c) => sum + c.units, 0);
  return (
    <section aria-labelledby="next-q" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="next-q" className="text-sm font-semibold">Your next quarter: what to sign up for in {label}</h2>
        <span className="text-xs text-muted">{units} units</span>
      </div>

      {courses.length > 0 ? (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {courses.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-2 rounded-lg bg-background px-3 py-2 text-sm">
              <a href={catalogueUrl(c.code)} target="_blank" rel="noreferrer" className="min-w-0 truncate hover:text-brand hover:underline">
                <span className="font-mono text-xs font-semibold">{c.code}</span> · {c.title}
              </a>
              <span className="shrink-0 text-xs text-muted">{c.kind === "added" ? "GE / elective" : c.kind === "prereq" ? "Prerequisite" : "Major"} · {c.units}u</span>
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

      <button type="button" onClick={onExplore} className="mt-3 text-sm font-medium text-brand hover:underline">
        Browse GEs and electives you can take in {label} →
      </button>

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
