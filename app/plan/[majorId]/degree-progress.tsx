import { UNITS_TO_GRADUATE } from "@/lib/ge";

// UCI class standing by completed units (UCI General Catalogue, Academic Regulations).
const STANDING = [
  { units: 45, label: "Sophomore" },
  { units: 90, label: "Junior" },
  { units: 135, label: "Senior" },
];

// A full-width bar: units completed (solid) and units planned for the upcoming quarter (lighter),
// out of the 180 a degree needs, with the class-standing milestones marked.
export function DegreeProgress({ done, upcoming, upcomingLabel, undeclared }: { done: number; upcoming: number; upcomingLabel: string; undeclared: boolean }) {
  const pct = (u: number) => Math.min(100, (u / UNITS_TO_GRADUATE) * 100);
  const standing = [...STANDING].reverse().find((s) => done >= s.units)?.label ?? "Freshman";
  return (
    <section aria-label="Degree progress" className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p>
          <span className="font-semibold">{Math.round(pct(done))}% of your degree</span>
          <span className="text-muted"> · {done} of {UNITS_TO_GRADUATE} units completed · {standing} standing</span>
        </p>
        {upcoming > 0 && <p className="text-xs text-muted">+{upcoming} units planned for {upcomingLabel}</p>}
      </div>
      <div
        className="relative mt-2 h-3 overflow-hidden rounded-full bg-subtle"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={UNITS_TO_GRADUATE}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${UNITS_TO_GRADUATE} units completed`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand/25" style={{ width: `${pct(done + upcoming)}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct(done)}%` }} />
        {STANDING.map((s) => <span key={s.units} aria-hidden className="absolute inset-y-0 w-px bg-surface" style={{ left: `${pct(s.units)}%` }} />)}
      </div>
      <div className="relative mt-1 h-4 text-[10px] text-muted" aria-hidden>
        {STANDING.map((s) => (
          <span key={s.units} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(s.units)}%` }}>
            <span className="hidden sm:inline">{s.label} · </span>{s.units}
          </span>
        ))}
        <span className="absolute right-0"><span className="hidden sm:inline">Graduate · </span>{UNITS_TO_GRADUATE}</span>
      </div>
      {undeclared && done >= 60 && done < 90 && (
        <p className="mt-2 text-xs text-warn-ink">UCI asks students to declare a major by junior standing (90 units). You&apos;re at {done}.</p>
      )}
    </section>
  );
}
