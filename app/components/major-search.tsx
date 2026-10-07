"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MajorSummary } from "@/lib/data";

// ICS majors get a shortcut row; everyone else searches.
const FEATURED = ["BS-19H", "BS-201", "BS-06G", "BS-193"];

const shortName = (name: string) => name.replace(/^Major in /, "");

export function MajorSearch({ majors }: { majors: MajorSummary[] }) {
  const [query, setQuery] = useState("");
  const featured = FEATURED.map((id) => majors.find((m) => m.id === id)).filter((m) => m !== undefined);
  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return majors.filter((m) => words.every((w) => m.name.toLowerCase().includes(w)));
  }, [majors, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {featured.map((m) => (
          <Link key={m.id} href={`/plan/${m.id}`} className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-brand hover:text-brand">
            {shortName(m.name)}
          </Link>
        ))}
      </div>

      <div>
        <label htmlFor="major-search" className="sr-only">Search majors</label>
        <input
          id="major-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${majors.length} majors…`}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-base shadow-sm outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface" aria-live="polite">
        {results.map((m) => (
          <li key={m.id}>
            <Link href={`/plan/${m.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-brand-soft focus-visible:bg-brand-soft focus-visible:outline-none">
              <span>{shortName(m.name)}</span>
              {m.degreeType && <span className="shrink-0 rounded bg-background px-2 py-0.5 font-mono text-xs text-muted">{m.degreeType}</span>}
            </Link>
          </li>
        ))}
        {results.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">No majors match “{query}”.</li>}
      </ul>
    </div>
  );
}
