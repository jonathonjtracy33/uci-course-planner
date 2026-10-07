"use client";

import { useId, useState } from "react";
import type { IndexCourse } from "@/lib/course-index";
import type { CourseIndex } from "./use-course-index";

const normalize = (s: string) => s.toUpperCase().replace(/\s+/g, "");

// Rank: exact code, code prefix, then title words.
export function searchCourses(index: Iterable<IndexCourse>, query: string, limit = 8): IndexCourse[] {
  const q = normalize(query);
  if (!q) return [];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { c: IndexCourse; score: number }[] = [];
  for (const c of index) {
    const code = normalize(c.code);
    const score = code === q ? 0 : code.startsWith(q) ? 1 : words.every((w) => c.title.toLowerCase().includes(w)) ? 2 : -1;
    if (score >= 0) scored.push({ c, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.c.code.length - b.c.code.length || a.c.code.localeCompare(b.c.code)).slice(0, limit).map((s) => s.c);
}

export function CourseSearch({ index, onFocus, onPick, placeholder }: {
  index: CourseIndex | null;
  onFocus: () => void;
  onPick: (course: IndexCourse) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const results = index ? searchCourses(index.values(), query) : [];

  const pick = (c: IndexCourse) => {
    onPick(c);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search all UCI courses"
        className="w-full rounded-lg border border-border bg-subtle px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        value={query}
        placeholder={placeholder}
        onFocus={() => { onFocus(); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && results[active]) { e.preventDefault(); pick(results[active]); }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && query && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {!index && <li className="px-3 py-2 text-xs text-muted">Loading all UCI courses…</li>}
          {index && results.length === 0 && <li className="px-3 py-2 text-xs text-muted">No courses match “{query}”.</li>}
          {results.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${i === active ? "bg-brand-soft" : ""}`}
            >
              <span className="font-mono text-xs font-semibold">{c.code}</span> <span className="text-muted">{c.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
