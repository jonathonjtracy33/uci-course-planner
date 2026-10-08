"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { MajorSearch } from "@/app/components/major-search";
import { Stepper } from "@/app/components/stepper";
import type { MajorSummary } from "@/lib/data";
import { fromStanding, SETUP_STEPS } from "@/lib/plan-settings";
import { planHref, withoutKeys } from "@/lib/questionnaire";

const SEASONS = ["Fall", "Winter", "Spring"] as const;
type Season = (typeof SEASONS)[number];
const ASSIST_URL = "https://assist.org/";
const CHANGE = "degreepath:start";

const STANDINGS = [
  { year: 1, transfer: false, label: "1st year", hint: "Starting at UCI, fresh from high school" },
  { year: 2, transfer: false, label: "2nd year", hint: "Sophomore" },
  { year: 3, transfer: false, label: "3rd year", hint: "Junior" },
  { year: 4, transfer: false, label: "4th year", hint: "Senior" },
  { year: 3, transfer: true, label: "Transfer student", hint: "Entering UCI as a junior" },
];

// The next four quarters a student could be starting, beginning with the one coming up.
function upcomingTerms(now: Date): string[] {
  const m = now.getMonth(); // 0 = January
  // Jul-Sep: Fall is next. Oct-Dec: Winter. Jan-Mar: Spring. Apr-Jun: Fall.
  const first = m >= 6 && m <= 8 ? 0 : m >= 9 ? 1 : m <= 2 ? 2 : 0;
  const fallYear = m <= 2 ? now.getFullYear() - 1 : now.getFullYear();
  return Array.from({ length: 4 }, (_, i) => {
    const k = first + i;
    const season = SEASONS[k % 3];
    const startFallYear = fallYear + Math.floor(k / 3);
    return `${season} ${startFallYear + (season === "Fall" ? 0 : 1)}`;
  });
}

// "Winter 2027" -> the Fall that starts that academic year (2026) and the season.
function parseTerm(label: string): { season: Season; startFallYear: number } | null {
  const [season, year] = label.split(" ");
  if (!SEASONS.includes(season as Season) || !Number(year)) return null;
  return { season: season as Season, startFallYear: Number(year) - (season === "Fall" ? 0 : 1) };
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

// Steps 1-4 of the questionnaire. Answers live in the URL (so the browser's Back button, the
// step bar, and "Edit my answers" all work), alongside any plan settings, which are carried
// through untouched.
export function StartFlow({ majors }: { majors: MajorSummary[] }) {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const today = useSyncExternalStore(() => () => {}, () => new Date().toDateString(), () => null);
  const params = new URLSearchParams(search);
  const step = Math.min(4, Math.max(1, Number(params.get("step")) || 1));
  const college = params.get("college");
  const yr = Number(params.get("yr")) || null;
  const transfer = params.get("tr") === "1";
  const standing = STANDINGS.find((s) => s.year === yr && s.transfer === transfer) ?? null;
  const upcoming = today ? upcomingTerms(new Date(today)) : [];
  const term = params.get("t") ?? upcoming[0] ?? null;
  const terms = term && !upcoming.includes(term) ? [term, ...upcoming] : upcoming;
  const currentMajor = params.get("major");

  // Change answers; moving to another step adds a history entry so the browser's Back works too.
  const set = (change: Record<string, string | null>) => {
    const next = new URLSearchParams(search);
    for (const [k, v] of Object.entries(change)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const url = `${window.location.pathname}?${next}`;
    if ("step" in change) window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(CHANGE));
    if ("step" in change) window.scrollTo({ top: 0 });
  };
  const go = (n: number) => set({ step: String(n), ...(n === 3 && !params.get("t") && term ? { t: term } : {}) });

  // Where each step can be reached from here: earlier steps always, later ones once answered.
  const reachable = (n: number) => n === 1 || (n === 2 && !!college) || (n === 3 && !!college && !!standing) || (n === 4 && !!college && !!standing && !!term);
  const parsed = term ? parseTerm(term) : null;
  const plan = standing && parsed ? fromStanding(standing.year, parsed.startFallYear, parsed.season) : null;
  const planSearch = plan
    ? `?${withoutKeys(search, ["step", "college", "yr", "tr", "t", "major"])}`
    : "";
  const toPlan = (major: string, setupStep: number) =>
    plan ? planHref(major, planSearch, { entry: String(plan.entryYear), from: plan.firstQuarter ? String(plan.firstQuarter) : null, setup: String(setupStep) }) : null;
  const majorQuery = (() => {
    if (!plan) return "";
    const href = toPlan("x", SETUP_STEPS.ap)!;
    return href.slice(href.indexOf("?"));
  })();

  const card = (selected: boolean) =>
    `rounded-xl border px-4 py-3 text-left ${selected ? "border-brand bg-brand-soft ring-2 ring-brand/30" : "border-border bg-surface hover:border-brand"}`;
  const next = (label: string, enabled: boolean, to: number) => (
    <button type="button" disabled={!enabled} onClick={() => go(to)} className="mt-8 w-full rounded-xl bg-brand px-4 py-3 font-medium text-white hover:brightness-110 disabled:opacity-40 sm:w-auto">
      {label} →
    </button>
  );
  const back = (to: number) => (
    <button type="button" onClick={() => go(to)} className="text-sm text-muted hover:text-brand">← Back</button>
  );

  return (
    <div>
      <Stepper
        step={step}
        targetFor={(n) => {
          if (n <= 4) return reachable(n) ? () => go(n) : null;
          return currentMajor && plan ? toPlan(currentMajor, n) : null;
        }}
      />

      {step === 1 && (
        <section aria-labelledby="college-q" className="mt-8">
          <h1 id="college-q" className="text-2xl font-semibold tracking-tight sm:text-3xl">Which college are you going to, or attending now?</h1>
          <p className="mt-2 text-muted">DegreePath uses each school&apos;s own catalog, requirements and class schedule.</p>
          <div className="mt-6 grid gap-2" role="radiogroup" aria-label="College">
            <button type="button" role="radio" aria-checked={college === "uci"} onClick={() => set({ college: "uci" })} className={`flex items-center justify-between ${card(college === "uci")}`}>
              <span>
                <span className="block font-medium">University of California, Irvine</span>
                <span className="block text-sm text-muted">UCI · 2026–27 catalog, live class schedule</span>
              </span>
              {college === "uci" && <span aria-hidden className="text-brand">✓</span>}
            </button>
            <p className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">More colleges are coming soon.</p>
          </div>
          {next("Next: your year", !!college, 2)}
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="standing-q" className="mt-8">
          {back(1)}
          <h1 id="standing-q" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Which year of college are you going into?</h1>
          <p className="mt-2 text-muted">This sets where your plan starts. Already at UCI? You&apos;ll add the classes you&apos;ve finished in step 6.</p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Year in college">
            {STANDINGS.map((s) => (
              <button key={s.label} type="button" role="radio" aria-checked={standing === s} onClick={() => set({ yr: String(s.year), tr: s.transfer ? "1" : null })} className={card(standing === s)}>
                <span className="block font-medium">{s.label}</span>
                <span className="block text-sm text-muted">{s.hint}</span>
              </button>
            ))}
          </div>
          {standing?.transfer && (
            <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm">
              Community college classes count at UCI through official agreements. Look up which UCI courses yours equal on{" "}
              <a href={ASSIST_URL} target="_blank" rel="noreferrer" className="font-medium text-brand underline">ASSIST.org ↗</a>, then add those UCI courses in step 6.
            </p>
          )}
          {next("Next: your quarter", !!standing, 3)}
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="quarter-q" className="mt-8">
          {back(2)}
          <h1 id="quarter-q" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Which quarter are you planning for?</h1>
          <p className="mt-2 text-muted">Usually the next quarter you&apos;ll sign up for. You&apos;ll get a recommended schedule for it, then a plan all the way to graduation.</p>
          <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Starting quarter">
            {terms.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={term === t}
                onClick={() => set({ t })}
                className={`rounded-full border px-4 py-1.5 text-sm ${term === t ? "border-brand bg-brand text-white" : "border-border bg-surface hover:border-brand"}`}
              >
                {t}{t === upcoming[0] && " (next)"}
              </button>
            ))}
          </div>
          {next("Next: your major", !!term, 4)}
        </section>
      )}

      {step === 4 && (
        <section aria-labelledby="major-q" className="mt-8">
          {back(3)}
          <h1 id="major-q" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">What&apos;s your major?</h1>
          <p className="mt-2 text-muted">Not sure yet? Choose Undeclared and you can try majors later without losing anything.</p>
          {currentMajor && toPlan(currentMajor, SETUP_STEPS.ap) && (
            <Link href={toPlan(currentMajor, SETUP_STEPS.ap)!} className="mt-5 flex items-center justify-between rounded-xl bg-brand px-4 py-3 font-medium text-white hover:brightness-110">
              <span>Keep {currentMajor === "undeclared" ? "Undeclared" : (majors.find((m) => m.id === currentMajor)?.name ?? currentMajor).replace(/^Major in /, "")}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          <div className="mt-6">
            <MajorSearch majors={majors} query={majorQuery} />
          </div>
        </section>
      )}
    </div>
  );
}
