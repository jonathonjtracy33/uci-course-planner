"use client";

import { useEffect, useRef, useState } from "react";
import { offeredIn } from "@/lib/course-index";
import { GE_CATALOGUE_URL, GE_CATEGORIES, type GeProgress } from "@/lib/ge";
import type { Season } from "@/lib/planner";
import type { CourseIndex } from "./use-course-index";

const LIMIT = 60;
const numeralOf = (code: string) => GE_CATEGORIES.find((c) => c.code === code)?.numeral ?? code;

export function GePicker({ quarter, category, index, progress, exclude, onAdd, onClose }: {
  quarter: { label: string; season: Season };
  category?: string;
  index: CourseIndex | null;
  progress: GeProgress;
  exclude: Set<string>; // already taken or planned
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const firstOpen = GE_CATEGORIES.find((c) => progress[c.code].done + progress[c.code].planned < c.need)?.code ?? "GE-2";
  const [selected, setSelected] = useState(category ?? firstOpen);
  const [query, setQuery] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const usual = GE_CATEGORIES.find((c) => c.code === selected)?.usual ?? [];
  const rank = (id: string) => (usual.includes(id) ? usual.indexOf(id) : usual.length);
  const matches = index
    ? [...index.values()]
        .filter((c) => c.ge.includes(selected) && offeredIn(c, quarter.season) && c.seasons !== "" && !exclude.has(c.id))
        .filter((c) => words.every((w) => `${c.code} ${c.title}`.toLowerCase().includes(w)))
        // the catalogue's standard choices first, then easiest to fit: no prerequisites, lower
        // division, then counts toward more GE categories
        .sort((a, b) => rank(a.id) - rank(b.id) || Number(a.hasPrereqs) - Number(b.hasPrereqs) || Number(a.number >= 100) - Number(b.number >= 100) || b.ge.length - a.ge.length || a.code.localeCompare(b.code))
    : [];
  const category_ = GE_CATEGORIES.find((c) => c.code === selected)!;
  const p = progress[selected];

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-labelledby="ge-picker-title"
      className="m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[85vh] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="border-b border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="ge-picker-title" className="text-base font-semibold">Add a GE to {quarter.label}</h2>
              <p className="mt-0.5 text-xs text-muted">
                Courses approved for each category that UCI has offered in {quarter.season} recently.{" "}
                <a href={GE_CATALOGUE_URL} target="_blank" rel="noreferrer" className="text-brand underline">UCI GE requirements ↗</a>
              </p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded-md px-2 text-lg leading-none text-muted hover:text-foreground">×</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="GE category">
            {GE_CATEGORIES.map((c) => {
              const done = progress[c.code].done + progress[c.code].planned >= c.need;
              return (
                <button
                  key={c.code}
                  type="button"
                  role="tab"
                  aria-selected={selected === c.code}
                  onClick={() => setSelected(c.code)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${selected === c.code ? "border-brand bg-brand text-white" : "border-border hover:border-brand"}`}
                >
                  {c.numeral}{done && " ✓"}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm">
            <span className="font-medium">{category_.numeral}. {category_.name}</span>{" "}
            <span className="text-muted">· {Math.min(p.done + p.planned, p.need)} of {p.need} {p.need === 1 ? "course" : "courses"}{category_.note && ` · ${category_.note}`}</span>
          </p>
          <input
            type="search"
            aria-label="Filter courses"
            placeholder="Filter by code or title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </header>

        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {!index && <li className="p-4 text-sm text-muted">Loading UCI courses…</li>}
          {index && matches.length === 0 && <li className="p-4 text-sm text-muted">No {category_.numeral} courses offered in {quarter.season} match.</li>}
          {matches.slice(0, LIMIT).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm"><span className="font-mono text-xs font-semibold">{c.code}</span> · {c.units} units</p>
                <p className="truncate text-xs text-muted">{c.title}</p>
                <p className="mt-0.5 flex flex-wrap gap-1">
                  {c.ge.map((g) => <span key={g} className="rounded bg-background px-1.5 text-[10px] font-medium text-muted">GE {numeralOf(g)}</span>)}
                  {c.hasPrereqs && <span className="rounded bg-warn-soft px-1.5 text-[10px] font-medium text-warn-ink">Has prerequisites</span>}
                </p>
              </div>
              <button type="button" onClick={() => { onAdd(c.id); dialog.current?.close(); }} className="shrink-0 rounded-lg border border-border px-3 py-1 text-sm hover:border-brand hover:text-brand">Add</button>
            </li>
          ))}
          {matches.length > LIMIT && <li className="p-3 text-center text-xs text-muted">Showing {LIMIT} of {matches.length}. Filter to narrow it down.</li>}
        </ul>
      </div>
    </dialog>
  );
}
