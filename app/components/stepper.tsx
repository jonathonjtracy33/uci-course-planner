import Link from "next/link";
import { STEP_NAMES, TOTAL_STEPS } from "@/lib/questionnaire";

// The questionnaire's progress, with every reachable step a link so students can go back and
// change any answer (or jump ahead to one they've already filled in).
// targetFor(n): a URL on another page, a function for a step on this page, or null (not reachable yet).
export function Stepper({ step, targetFor }: { step: number; targetFor: (step: number) => string | (() => void) | null }) {
  return (
    <nav aria-label="Questionnaire steps">
      <p className="text-sm font-medium text-brand">Step {step} of {TOTAL_STEPS} · {STEP_NAMES[step - 1]}</p>
      <ol className="mt-2 grid grid-cols-7 gap-1">
        {STEP_NAMES.map((name, i) => {
          const n = i + 1;
          const target = n === step ? null : targetFor(n);
          const bar = <span className={`block h-1.5 rounded-full ${n <= step ? "bg-brand" : "bg-border"} ${target ? "group-hover:bg-brand/60" : ""}`} />;
          const label = <span className={`mt-1 hidden truncate text-[11px] sm:block ${n === step ? "font-semibold text-foreground" : "text-muted"}`}>{name}</span>;
          return (
            <li key={name}>
              {typeof target === "string" ? (
                <Link href={target} className="group block" aria-label={`Go to step ${n}: ${name}`}>{bar}{label}</Link>
              ) : target ? (
                <button type="button" onClick={target} className="group block w-full text-left" aria-label={`Go to step ${n}: ${name}`}>{bar}{label}</button>
              ) : (
                <span className="block" aria-current={n === step ? "step" : undefined}>{bar}{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
