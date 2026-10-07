"use client";

import { useEffect, useRef, useState } from "react";
import type { IndexCourse } from "@/lib/course-index";
import { catalogueUrl } from "@/lib/links";
import { searchCourses } from "./course-search";
import type { CourseIndex } from "./use-course-index";

const MINORS_URL = "https://catalogue.uci.edu/undergraduatedegrees/";

// Add any UCI course to a quarter: an elective, a minor course, or something to explore.
export function AddCourseDialog({ quarter, index, exclude, onAdd, onShowCourse, onClose }: {
  quarter: { label: string; season: "Fall" | "Winter" | "Spring" };
  index: CourseIndex | null;
  exclude: Set<string>;
  onAdd: (id: string) => void;
  onShowCourse: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const offered = (c: IndexCourse) => c.seasons === "*" || c.seasons.includes(quarter.season[0]);
  const results = index ? searchCourses([...index.values()].filter((c) => !exclude.has(c.id)), query, 25) : [];

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      aria-labelledby="add-course-title"
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[85vh] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="border-b border-border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="add-course-title" className="text-base font-semibold">Add a course to {quarter.label}</h2>
              <p className="mt-0.5 text-xs text-muted">
                Any UCI course counts toward the 180 units you need: a minor, a second major, or something you&apos;re curious about.{" "}
                <a href={MINORS_URL} target="_blank" rel="noreferrer" className="text-brand underline">Browse UCI majors and minors ↗</a>
              </p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="rounded-md px-2 text-lg leading-none text-muted hover:text-foreground">×</button>
          </div>
          <input
            type="search"
            autoFocus
            aria-label="Search all UCI courses"
            placeholder="Search by code or title, e.g. MUSIC 14 or photography"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mt-3 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </header>
        <ul className="flex-1 divide-y divide-border overflow-y-auto">
          {!index && <li className="p-4 text-sm text-muted">Loading all UCI courses…</li>}
          {index && !query && <li className="p-4 text-sm text-muted">Start typing to search all ~9,300 UCI courses.</li>}
          {index && query && results.length === 0 && <li className="p-4 text-sm text-muted">No courses match “{query}”.</li>}
          {results.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <a href={catalogueUrl(c.code)} target="_blank" rel="noreferrer" className={`text-sm hover:text-brand ${c.hasPrereqs ? "underline decoration-red-500 decoration-2 underline-offset-4" : "hover:underline"}`}>
                  <span className="font-mono text-xs font-semibold">{c.code}</span> · {c.title}
                </a>
                <p className="mt-0.5 text-xs text-muted">
                  {c.units} units
                  {c.seasons === "" ? " · not offered recently" : !offered(c) ? ` · not usually offered in ${quarter.season}` : ""}
                </p>
                {c.hasPrereqs && (
                  <button type="button" onClick={() => onShowCourse(c.id)} className="mt-0.5 text-xs text-red-600 underline underline-offset-2 dark:text-red-400">
                    Has prerequisites: see what it requires
                  </button>
                )}
              </div>
              <button type="button" onClick={() => { onAdd(c.id); dialog.current?.close(); }} className="shrink-0 rounded-lg border border-border px-3 py-1 text-sm hover:border-brand hover:text-brand">Add</button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
