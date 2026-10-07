"use client";

import { useState, useSyncExternalStore } from "react";
import { MajorSearch } from "@/app/components/major-search";
import type { MajorSummary } from "@/lib/data";
import { fromStanding, SETUP_STEPS, TOTAL_STEPS } from "@/lib/plan-settings";

const SEASONS = ["Fall", "Winter", "Spring"] as const;
type Season = (typeof SEASONS)[number];
const ASSIST_URL = "https://assist.org/";

const STANDINGS = [
  { year: 1, label: "1st year", hint: "Starting at UCI, fresh from high school" },
  { year: 2, label: "2nd year", hint: "Sophomore" },
  { year: 3, label: "3rd year", hint: "Junior" },
  { year: 4, label: "4th year", hint: "Senior" },
  { year: 3, label: "Transfer student", hint: "Entering UCI as a junior", transfer: true },
];

// The next four quarters a student could be starting, beginning with the one coming up.
function upcomingTerms(now: Date) {
  const m = now.getMonth(); // 0 = January
  // Jul-Sep: Fall is next. Oct-Dec: Winter. Jan-Mar: Spring. Apr-Jun: Fall.
  const first = m >= 6 && m <= 8 ? 0 : m >= 9 ? 1 : m <= 2 ? 2 : 0;
  const fallYear = m >= 9 || (m >= 6 && m <= 8) ? now.getFullYear() : m <= 2 ? now.getFullYear() - 1 : now.getFullYear();
  return Array.from({ length: 4 }, (_, i) => {
    const k = first + i;
    const season = SEASONS[k % 3] as Season;
    const startFallYear = fallYear + Math.floor(k / 3);
    return { season, startFallYear, label: `${season} ${startFallYear + (season === "Fall" ? 0 : 1)}` };
  });
}

const noSubscribe = () => () => {};

export function StartFlow({ majors }: { majors: MajorSummary[] }) {
  const [standing, setStanding] = useState<(typeof STANDINGS)[number] | null>(null);
  const [termIndex, setTermIndex] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [college, setCollege] = useState<string | null>(null);
  // Dates come from the browser so the choices are right whenever the page is opened.
  const now = useSyncExternalStore(noSubscribe, () => new Date().toDateString(), () => null);
  const terms = now ? upcomingTerms(new Date(now)) : [];
  const term = terms[termIndex];

  const query = standing && term
    ? (() => {
        const { entryYear, firstQuarter } = fromStanding(standing.year, term.startFallYear, term.season);
        const params = new URLSearchParams({ entry: String(entryYear), setup: String(SETUP_STEPS.ap) });
        if (firstQuarter) params.set("from", String(firstQuarter));
        return `?${params}`;
      })()
    : "";

  return (
    <div>
      <p className="text-sm font-medium text-brand">Step {step} of {TOTAL_STEPS}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border" aria-hidden>
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>

      {step === 1 && (
        <section aria-labelledby="college-q" className="mt-8">
          <h1 id="college-q" className="text-2xl font-semibold tracking-tight sm:text-3xl">Which college are you going to, or attending now?</h1>
          <p className="mt-2 text-muted">DegreePath uses each school&apos;s own catalog, requirements and class schedule.</p>
          <div className="mt-6 grid gap-2" role="radiogroup" aria-label="College">
            <button
              type="button"
              role="radio"
              aria-checked={college === "uci"}
              onClick={() => setCollege("uci")}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${college === "uci" ? "border-brand bg-brand-soft ring-2 ring-brand/30" : "border-border bg-surface hover:border-brand"}`}
            >
              <span>
                <span className="block font-medium">University of California, Irvine</span>
                <span className="block text-sm text-muted">UCI · 2026–27 catalog, live class schedule</span>
              </span>
              {college === "uci" && <span aria-hidden className="text-brand">✓</span>}
            </button>
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">More colleges are coming soon.</p>
          </div>
          <button type="button" disabled={!college} onClick={() => setStep(2)} className="mt-8 w-full rounded-xl bg-brand px-4 py-3 font-medium text-white hover:brightness-110 disabled:opacity-40 sm:w-auto">
            Next: your year →
          </button>
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="standing-q" className="mt-8">
          <button type="button" onClick={() => setStep(1)} className="text-sm text-muted hover:text-brand">← Back</button>
          <h1 id="standing-q" className="text-2xl font-semibold tracking-tight sm:text-3xl">Which year of college are you going into?</h1>
          <p className="mt-2 text-muted">This sets where your plan starts. Already at UCI? You&apos;ll add the classes you&apos;ve finished next.</p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Year in college">
            {STANDINGS.map((s) => (
              <button
                key={s.label}
                type="button"
                role="radio"
                aria-checked={standing?.label === s.label}
                onClick={() => setStanding(s)}
                className={`rounded-xl border px-4 py-3 text-left ${standing?.label === s.label ? "border-brand bg-brand-soft ring-2 ring-brand/30" : "border-border bg-surface hover:border-brand"}`}
              >
                <span className="block font-medium">{s.label}</span>
                <span className="block text-sm text-muted">{s.hint}</span>
              </button>
            ))}
          </div>
          {standing?.transfer && (
            <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm">
              Community college classes count at UCI through official agreements. Look up which UCI courses yours equal on{" "}
              <a href={ASSIST_URL} target="_blank" rel="noreferrer" className="font-medium text-brand underline">ASSIST.org ↗</a>, then add those UCI courses in step 3.
            </p>
          )}

          <button type="button" disabled={!standing} onClick={() => setStep(3)} className="mt-8 w-full rounded-xl bg-brand px-4 py-3 font-medium text-white hover:brightness-110 disabled:opacity-40 sm:w-auto">
            Next: your quarter →
          </button>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="quarter-q" className="mt-8">
          <button type="button" onClick={() => setStep(2)} className="text-sm text-muted hover:text-brand">← Back</button>
          {terms.length > 0 && (
            <div className="mt-2">
              <h1 id="quarter-q" className="text-2xl font-semibold tracking-tight sm:text-3xl">Which quarter are you planning for?</h1>
              <p className="mt-2 text-muted">Usually the next quarter you&apos;ll sign up for. You&apos;ll get a recommended schedule for it, then a plan all the way to graduation.</p>
              <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Starting quarter">
                {terms.map((t, i) => (
                  <button
                    key={t.label}
                    type="button"
                    role="radio"
                    aria-checked={termIndex === i}
                    onClick={() => setTermIndex(i)}
                    className={`rounded-full border px-4 py-1.5 text-sm ${termIndex === i ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
                  >
                    {t.label}{i === 0 && " (next)"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button type="button" onClick={() => setStep(4)} className="mt-8 w-full rounded-xl bg-brand px-4 py-3 font-medium text-white hover:brightness-110 sm:w-auto">
            Next: your major →
          </button>
        </section>
      )}

      {step === 4 && (
        <section aria-labelledby="major-q" className="mt-8">
          <button type="button" onClick={() => setStep(3)} className="text-sm text-muted hover:text-brand">← Back</button>
          <h1 id="major-q" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">What&apos;s your major?</h1>
          <p className="mt-2 text-muted">Not sure yet? Choose Undeclared and you can try majors later without losing anything.</p>
          <div className="mt-6">
            <MajorSearch majors={majors} query={query} />
          </div>
        </section>
      )}
    </div>
  );
}
