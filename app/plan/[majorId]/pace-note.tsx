import type { Pace } from "@/lib/pace";
import { TYPICAL_UNITS } from "@/lib/pace";

const GRADUATION = "https://www.reg.uci.edu/grades/commencement.html"; // UCI Registrar: Graduation and Commencement
const SUMMER = "https://summer.uci.edu/";

// What the plan is doing for the student's pace, in plain words, and (for an early finish) the steps.
export function PaceNote({ pace, ahead, gradLabel, summersAdded, summerLabels, unitsPerQuarter, maxUnits, onSwitch }: {
  pace: Pace;
  ahead: number; // units ahead (+) or behind (-) a typical 4-year pace
  gradLabel: string;
  summersAdded: boolean; // on time, but summer classes were needed to catch up
  summerLabels: string[];
  unitsPerQuarter: number;
  maxUnits: number;
  onSwitch: (pace: Pace) => void;
}) {
  const box = "rounded-xl border px-4 py-3 text-sm";
  if (pace === "early")
    return (
      <section aria-label="Graduating early" className={`${box} border-brand/40 bg-brand-soft`}>
        <p className="font-medium">Your path to graduating early, by {gradLabel}</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li><span className="text-foreground">Take summer classes.</span> Your plan uses {summerLabels.length ? summerLabels.join(", ") : "summer sessions"} with courses UCI actually offers in summer. <a className="text-brand underline" href={SUMMER} target="_blank" rel="noreferrer">UCI Summer Session ↗</a></li>
          <li><span className="text-foreground">Carry heavier quarters.</span> Your plan allows up to {maxUnits} units a quarter. Check your school&apos;s unit limit with your counselor before going higher.</li>
          <li><span className="text-foreground">Use every credit you have.</span> Add all AP exams and transfer courses in Edit my answers so you don&apos;t retake anything.</li>
          <li><span className="text-foreground">Mind senior residency.</span> UCI requires 36 of your final 45 units to be taken at UCI.</li>
          <li><span className="text-foreground">Apply to graduate.</span> Graduation isn&apos;t automatic: file the Application for Graduation in StudentAccess for {gradLabel}, ideally at the start of your last year, and get a degree check with your counselor. <a className="text-brand underline" href={GRADUATION} target="_blank" rel="noreferrer">Registrar: graduation ↗</a></li>
        </ol>
      </section>
    );
  if (pace === "balanced")
    return (
      <section aria-label="Balanced pace" className={`${box} border-border bg-surface`}>
        <p><span className="font-medium">Balanced pace:</span> about {unitsPerQuarter} units a quarter, graduating {gradLabel}. Lighter quarters leave room for work, research or a minor.</p>
      </section>
    );
  if (summersAdded)
    return (
      <section aria-label="Catching up" className={`${box} border-warn-ink/30 bg-warn-soft text-warn-ink`}>
        <p>
          {ahead < 0
            ? <><span className="font-semibold">You&apos;re about {-ahead} units behind a 4-year pace,</span> so your plan adds summer classes ({summerLabels.join(", ")}) to still graduate {gradLabel}.</>
            : <><span className="font-semibold">Your major&apos;s required courses build on each other in a long chain,</span> so finishing by {gradLabel} takes summer classes ({summerLabels.join(", ")}). AP or transfer credit can shorten it.</>}{" "}
          <button type="button" onClick={() => onSwitch("balanced")} className="font-medium underline">Prefer a steadier pace without summers?</button>
        </p>
      </section>
    );
  if (ahead >= TYPICAL_UNITS)
    return (
      <section aria-label="Ahead of pace" className={`${box} border-emerald-600/30 bg-emerald-500/10 text-emerald-800`}>
        <p>
          <span className="font-semibold">You&apos;re about {ahead} units ahead of a 4-year pace,</span> so your plan uses lighter quarters (about {unitsPerQuarter} units) and still graduates {gradLabel}.{" "}
          <button type="button" onClick={() => onSwitch("early")} className="font-medium underline">Want to graduate early instead?</button>
        </p>
      </section>
    );
  return null;
}
