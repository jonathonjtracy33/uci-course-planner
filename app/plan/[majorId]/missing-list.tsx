"use client";

import type { Missing } from "@/lib/prereq-status";

const SHOW_ALTERNATIVES = 2;

// "WRITING 39B (or WRITING 50, WRITING 45, +4 more) and MATH 2A": every course is a button that
// opens what it requires.
export function MissingList({ missing, onShowCourse }: { missing: Missing[]; onShowCourse: (id: string) => void }) {
  const course = (id: string, code: string) => (
    <button key={id} type="button" onClick={() => onShowCourse(id)} className="font-mono font-semibold underline decoration-red-500 underline-offset-2 hover:text-red-700 dark:hover:text-red-300">
      {code}
    </button>
  );
  return (
    <>
      {missing.map((m, i) => (
        <span key={m.kind === "course" ? m.id : m.kind === "exam" ? m.name : m.text}>
          {i > 0 && (i === missing.length - 1 ? " and " : ", ")}
          {m.kind === "course" ? (
            <>
              {course(m.id, m.code)}
              {m.or && m.or.length > 0 && (
                <>
                  {" (or "}
                  {m.or.slice(0, SHOW_ALTERNATIVES).map((o, j) => <span key={o.id}>{j > 0 && ", "}{course(o.id, o.code)}</span>)}
                  {m.or.length > SHOW_ALTERNATIVES && `, +${m.or.length - SHOW_ALTERNATIVES} more`}
                  {")"}
                </>
              )}
            </>
          ) : (
            <span className="font-semibold">{m.kind === "exam" ? m.name : m.text}</span>
          )}
        </span>
      ))}
    </>
  );
}
