"use client";

import { useEffect, useState } from "react";
import { chooseSections, clock, conflicts, layoutLanes, toBlocks, type Section } from "@/lib/calendar";
import { catalogueUrl } from "@/lib/links";
import { fetchSections } from "@/lib/websoc";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START = 8 * 60; // 8am
const END = 22 * 60; // 10pm
const PX_PER_MIN = 0.8;
const COLORS = ["#0064a4", "#2a8f8c", "#7c3aed", "#c2410c", "#be185d", "#4d7c0f", "#1d4ed8", "#a16207"];

export type CalendarCourse = { id: string; code: string; title: string; units: number };

// The upcoming quarter as a week, like AntAlmanac: one lecture (and discussion/lab) per course,
// from UCI's live Schedule of Classes. Before UCI posts that quarter, the newest posted quarter's
// times are shown as a preview.
export function CalendarView({ quarterLabel, liveTerm, courses, chosen, onChoose }: {
  quarterLabel: string;
  liveTerm: string | null;
  courses: CalendarCourse[];
  chosen: string[]; // section codes the student picked
  onChoose: (codes: string[]) => void;
}) {
  const posted = liveTerm === quarterLabel;
  const [preview, setPreview] = useState(false);
  const term = posted ? quarterLabel : preview ? liveTerm : null;
  const [loaded, setLoaded] = useState<{ key: string; sections: Record<string, Section[]> } | null>(null);
  const key = `${term}|${courses.map((c) => c.id).join(",")}`;

  useEffect(() => {
    if (!term) return;
    let cancelled = false;
    Promise.all(courses.map((c) => fetchSections(term, c.code).then((s) => [c.id, s] as const))).then((pairs) => {
      if (!cancelled) setLoaded({ key, sections: Object.fromEntries(pairs) });
    });
    return () => {
      cancelled = true;
    };
  }, [term, key, courses]);

  if (!term) {
    return (
      <section className="rounded-xl border border-border bg-surface p-6 text-sm">
        <h2 className="text-base font-semibold">Weekly calendar for {quarterLabel}</h2>
        <p className="mt-2 text-muted">
          UCI hasn&apos;t posted the {quarterLabel} Schedule of Classes yet. It usually comes out about 6 weeks before the quarter, and
          DegreePath picks it up the next night. Then you&apos;ll see real class times here and can choose your sections.
        </p>
        {liveTerm && (
          <button type="button" onClick={() => setPreview(true)} className="mt-4 rounded-lg bg-brand px-4 py-2 font-medium text-white hover:brightness-110">
            Preview with {liveTerm} times
          </button>
        )}
      </section>
    );
  }

  const sections = loaded?.key === key ? loaded.sections : null;
  const chosenSet = new Set(chosen);
  const picks = courses.map((c, i) => ({ course: c, color: COLORS[i % COLORS.length], all: sections?.[c.id] ?? [], picked: chooseSections(sections?.[c.id] ?? [], chosenSet) }));
  const blocks = picks.flatMap((p) => toBlocks(p.course.id, p.course.code, p.picked).map((b) => ({ ...b, color: p.color })));
  const clashes = conflicts(blocks);
  const slot = (b: { section: Section; day: number; start: number }) => `${b.section.code}|${b.day}|${b.start}`;
  const clashing = new Set(clashes.flatMap(([a, b]) => [slot(a), slot(b)]));
  const offList = picks.filter((p) => sections && p.all.length === 0);
  const unscheduledTimes = picks.flatMap((p) => p.picked.filter((s) => s.meetings.length === 0).map((s) => `${p.course.code} ${s.type}`));

  // Choosing a section replaces any other section of that type for the same course.
  const pick = (type: string, code: string, all: Section[]) => {
    const sameType = new Set(all.filter((s) => s.type === type).map((s) => s.code));
    onChoose([...chosen.filter((c) => !sameType.has(c)), code]);
  };

  return (
    <section className="rounded-xl border border-border bg-surface" aria-labelledby="cal-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border p-4">
        <div>
          <h2 id="cal-title" className="text-base font-semibold">Weekly calendar · {posted ? quarterLabel : `${quarterLabel} (preview with ${liveTerm} times)`}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {posted ? "Live from UCI's Schedule of Classes. Pick a section for each class; enroll in WebReg with the 5-digit codes." : `UCI hasn't posted ${quarterLabel} yet, so these are last term's times. Real ${quarterLabel} times will differ.`}
          </p>
        </div>
        <span className="text-sm text-muted">{courses.reduce((s, c) => s + c.units, 0)} units</span>
      </div>

      {clashes.length > 0 && (
        <p className="mx-4 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">
          ⚠ Time conflict: {[...new Set(clashes.map(([a, b]) => `${a.label} ${a.section.type} and ${b.label} ${b.section.type}`))].join("; ")}. Pick a different section below.
        </p>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_18rem]">
        {/* Week grid */}
        <div className="overflow-x-auto">
          <div className="relative grid min-w-[36rem] grid-cols-[3rem_repeat(5,1fr)]" style={{ height: (END - START) * PX_PER_MIN + 24 }}>
            <div />
            {DAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-muted">{d}</div>)}
            {Array.from({ length: (END - START) / 60 + 1 }, (_, h) => (
              <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ top: 24 + h * 60 * PX_PER_MIN }}>
                <span className="absolute -top-2 left-0 bg-surface pr-1 text-[10px] text-muted">{clock(START + h * 60).replace(":00", "")}</span>
              </div>
            ))}
            {[0, 1, 2, 3, 4].flatMap((day) => layoutLanes(blocks.filter((b) => b.day === day && b.end > START && b.start < END))).map((b, i) => (
              <div
                key={`${b.section.code}-${b.day}-${i}`}
                className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-[10px] leading-tight text-white shadow-sm ${clashing.has(slot(b)) ? "ring-2 ring-red-500 ring-offset-1" : ""}`}
                style={{
                  top: 24 + (Math.max(b.start, START) - START) * PX_PER_MIN,
                  height: Math.max(18, (Math.min(b.end, END) - Math.max(b.start, START)) * PX_PER_MIN - 2),
                  // overlapping classes share the day column side by side
                  left: `calc(3rem + (100% - 3rem) * ${b.day} / 5 + (100% - 3rem) / 5 * ${b.lane} / ${b.lanes} + 2px)`,
                  width: `calc((100% - 3rem) / 5 / ${b.lanes} - 4px)`,
                  background: b.color,
                }}
                title={`${b.label} ${b.section.type} ${b.section.code} · ${clock(b.start)}–${clock(b.end)} ${b.place}`}
              >
                <p className="font-semibold">{b.label} <span className="font-normal opacity-90">{b.section.type}</span></p>
                <p className="opacity-90">{clock(b.start)}–{clock(b.end)}</p>
                {b.place && <p className="opacity-90">{b.place}</p>}
              </div>
            ))}
          </div>
          {!sections && <p className="mt-2 text-xs text-muted">Loading class times…</p>}
        </div>

        {/* Section pickers */}
        <ul className="space-y-3">
          {picks.map((p) => (
            <li key={p.course.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center gap-2">
                <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: p.color }} />
                <a href={catalogueUrl(p.course.code)} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium hover:text-brand hover:underline">
                  <span className="font-mono text-xs">{p.course.code}</span> · {p.course.title}
                </a>
              </div>
              {sections && p.all.length === 0 && <p className="mt-1 text-xs text-red-600">Not on the {term} schedule.</p>}
              {[...new Set(p.all.map((s) => s.type))].map((type) => {
                const current = p.picked.find((s) => s.type === type);
                return (
                  <label key={type} className="mt-2 block text-xs text-muted">
                    {type}
                    <select
                      value={current?.code ?? ""}
                      onChange={(e) => pick(type, e.target.value, p.all)}
                      className="mt-0.5 w-full rounded-md border border-border bg-subtle px-2 py-1 text-xs text-foreground"
                    >
                      {p.all.filter((s) => s.type === type).map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} · {s.meetings[0] ? `${s.meetings.map((m) => m.days.map((d) => DAYS[d] ?? "").join("/")).join(" ")} ${clock(s.meetings[0].start)}` : "TBA"}
                          {" · "}{s.status === "OPEN" ? `${s.seatsLeft} open` : s.status}{s.instructors[0] ? ` · ${s.instructors[0]}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
            </li>
          ))}
          {courses.length === 0 && <li className="text-sm text-muted">No classes planned for {quarterLabel} yet. Add some on the Upcoming quarter tab.</li>}
        </ul>
      </div>

      {(offList.length > 0 || unscheduledTimes.length > 0) && (
        <p className="px-4 pb-4 text-xs text-muted">
          {unscheduledTimes.length > 0 && <>No set meeting time (online or TBA): {unscheduledTimes.join(", ")}. </>}
        </p>
      )}
    </section>
  );
}
