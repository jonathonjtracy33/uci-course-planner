"use client";

import { GE_CATALOGUE_URL, GE_CATEGORIES, V_TOTAL, type GeProgress } from "@/lib/ge";

export function GePanel({ progress, onFind, onAutoPlan, autoReady, note }: {
  progress: GeProgress;
  onFind: (category: string) => void;
  onAutoPlan: () => void;
  autoReady: boolean;
  note: string | null;
}) {
  const rows = GE_CATEGORIES.flatMap((c) => (c.code === "GE-5B"
    ? [c, { code: "GE-5", numeral: "V", name: "Category V total (Va + Vb + one more)", need: V_TOTAL, note: undefined }]
    : [c]));
  const complete = GE_CATEGORIES.filter((c) => progress[c.code].done + progress[c.code].planned >= c.need).length;

  return (
    <section aria-labelledby="ge-heading" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ge-heading" className="text-sm font-semibold">General Education <span className="font-normal text-muted">· {complete} of {GE_CATEGORIES.length} categories covered</span></h2>
        <a href={GE_CATALOGUE_URL} target="_blank" rel="noreferrer" className="text-xs text-brand underline">UCI GE requirements ↗</a>
      </div>
      <p className="mt-1 text-xs text-muted">Major courses that are also approved GEs count automatically. One course can fill several categories.</p>
      {complete < GE_CATEGORIES.length && (
        <button
          type="button"
          onClick={onAutoPlan}
          disabled={!autoReady}
          className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
        >
          {autoReady ? "✨ Plan my GEs for me" : "Loading GE courses…"}
        </button>
      )}
      {note && <p className="mt-2 text-xs text-muted" role="status">{note}</p>}
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map((c) => {
          const p = progress[c.code];
          const have = p.done + p.planned;
          const status = p.done >= c.need ? "done" : have >= c.need ? "planned" : "open";
          return (
            <li key={c.code} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate">
                <span className={`mr-1.5 inline-block w-4 text-center ${status === "open" ? "text-muted" : "text-brand"}`} aria-hidden>{status === "done" ? "✓" : status === "planned" ? "◐" : "○"}</span>
                <span className="font-medium">{c.numeral}</span> <span className="text-muted">{c.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs tabular-nums text-muted" aria-label={`${have} of ${c.need}`}>{Math.min(have, c.need)}/{c.need}</span>
                {status === "open" && c.code !== "GE-5" && (
                  <button type="button" onClick={() => onFind(c.code)} className="rounded-md border border-border px-2 py-0.5 text-xs hover:border-brand hover:text-brand">Add</button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">✓ done · ◐ planned · ○ still needed</p>
    </section>
  );
}
