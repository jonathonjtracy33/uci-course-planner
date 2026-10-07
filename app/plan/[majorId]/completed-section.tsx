"use client";

import { catalogueUrl } from "@/lib/links";
import type { CourseFacts } from "./plan-view";

// Everything already done, at the top of the full planner: courses taken and AP credit.
export function CompletedSection({ taken, apCredit, unitsDone, onRemove }: {
  taken: { id: string; facts: CourseFacts | null }[];
  apCredit: [string, number][];
  unitsDone: number;
  onRemove: (id: string) => void;
}) {
  if (!taken.length && !apCredit.length && !unitsDone) return null;
  return (
    <section aria-labelledby="completed" className="mt-6 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="completed" className="text-sm font-semibold">Completed so far</h2>
        <span className="text-xs text-muted">{unitsDone} units</span>
      </div>
      {taken.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {taken.map(({ id, facts }) => (
            <li key={id} className="flex items-center gap-1 rounded-full border border-border bg-subtle py-0.5 pl-2.5 pr-1 text-xs">
              <span aria-hidden className="text-emerald-600">✓</span>
              {facts ? <a href={catalogueUrl(facts.code)} target="_blank" rel="noreferrer" className="font-mono hover:text-brand hover:underline" title={facts.title}>{facts.code}</a> : <span className="font-mono">{id}</span>}
              <button type="button" onClick={() => onRemove(id)} aria-label={`Remove ${facts?.code ?? id}`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground">×</button>
            </li>
          ))}
        </ul>
      )}
      {apCredit.length > 0 && (
        <p className="mt-3 text-xs text-muted">AP credit: {apCredit.map(([name, score]) => `${name.replace(/^AP /, "")} (${score})`).join(", ")}</p>
      )}
    </section>
  );
}
