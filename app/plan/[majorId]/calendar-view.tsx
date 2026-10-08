"use client";

import { useEffect, useRef, useState } from "react";
import { chooseSections, clock, conflicts, finalsSchedule, layoutLanes, toBlocks, type Block, type Section } from "@/lib/calendar";
import type { GeCandidate } from "@/lib/ge-recommend";
import { catalogueUrl, rateMyProfessorsUrl } from "@/lib/links";
import type { Season } from "@/lib/planner";
import type { StudentState } from "@/lib/prereq-status";
import type { Standing } from "@/lib/restrictions";
import { fetchTermDates, formatDate } from "@/lib/term-dates";
import { fetchGpa, fetchSections, type GpaInfo } from "@/lib/websoc";
import { CalendarSearch } from "./calendar-search";
import type { CourseIndex } from "./use-course-index";

const RESTRICTION_CODES = "https://www.reg.uci.edu/enrollment/restrict_codes.html";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const START = 8 * 60; // 8am
const END = 22 * 60; // 10pm
const PX_PER_MIN = 0.8;
const COLORS = ["#0064a4", "#2a8f8c", "#7c3aed", "#c2410c", "#be185d", "#4d7c0f", "#1d4ed8", "#a16207"];

export type CalendarCourse = { id: string; code: string; title: string; units: number };

// The upcoming quarter as a week, like AntAlmanac: one lecture (and discussion/lab) per course,
// from UCI's live Schedule of Classes. Before UCI posts that quarter, the newest posted quarter's
// times are shown as a preview.
export function CalendarView({ quarterLabel, season, liveTerm, courses, chosen, onChoose, search }: {
  quarterLabel: string;
  season: Season;
  liveTerm: string | null;
  courses: CalendarCourse[];
  chosen: string[]; // section codes the student picked
  onChoose: (codes: string[]) => void;
  search: {
    index: CourseIndex | null;
    onSearchFocus: () => void;
    detailsOf: (id: string) => GeCandidate | null;
    student: StudentState;
    standing: Standing;
    owned: Set<string>;
    maxUnits: number;
    onAdd: (id: string) => void;
    onShowCourse: (id: string) => void;
  };
}) {
  const posted = liveTerm === quarterLabel;
  const [preview, setPreview] = useState(false);
  const term = posted ? quarterLabel : preview ? liveTerm : null;
  const [loaded, setLoaded] = useState<{ key: string; sections: Record<string, Section[]> } | null>(null);
  const [mode, setMode] = useState<"classes" | "finals">("classes");
  const [postsOn, setPostsOn] = useState<{ label: string; date: string | null } | null>(null);
  useEffect(() => {
    if (posted) return;
    let cancelled = false;
    fetchTermDates(quarterLabel).then((d) => !cancelled && setPostsOn({ label: quarterLabel, date: d?.socAvailable ?? null }));
    return () => {
      cancelled = true;
    };
  }, [posted, quarterLabel]);
  const postDate = postsOn?.label === quarterLabel ? postsOn.date : null;
  const [hover, setHover] = useState<{ slot: string; block: Block & { color: string }; pinned: boolean } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const unitsPlanned = courses.reduce((s, c) => s + c.units, 0);
  const searchBar = (blocks: Block[]) => (
    <CalendarSearch {...search} quarterLabel={quarterLabel} season={season} postedTerm={posted ? quarterLabel : null} timesTerm={term} unitsPlanned={unitsPlanned} blocks={blocks} />
  );

  if (!term) {
    return (
      <section className="rounded-xl border border-border bg-surface text-sm">
        <h2 className="px-6 pt-6 text-base font-semibold">Weekly calendar for {quarterLabel}</h2>
        <div className="mt-3">{searchBar([])}</div>
        <div className="p-6 pt-4">
        <p className="mt-2 text-muted">
          UCI hasn&apos;t posted the {quarterLabel} Schedule of Classes yet.{" "}
          {postDate ? <>UCI&apos;s calendar says it comes out <span className="font-medium text-foreground">{formatDate(postDate)}</span>, and</> : <>It usually comes out about 6 weeks before the quarter, and</>}{" "}
          DegreePath picks it up the next night. Then you&apos;ll see real class times here and can choose your sections.
        </p>
        {liveTerm && (
          <button type="button" onClick={() => setPreview(true)} className="mt-4 rounded-lg bg-brand px-4 py-2 font-medium text-white hover:brightness-110">
            Preview with {liveTerm} times
          </button>
        )}
        </div>
      </section>
    );
  }

  const sections = loaded?.key === key ? loaded.sections : null;
  const chosenSet = new Set(chosen);
  const picks = courses.map((c, i) => ({ course: c, color: COLORS[i % COLORS.length], all: sections?.[c.id] ?? [], picked: chooseSections(sections?.[c.id] ?? [], chosenSet) }));
  const blocks = picks.flatMap((p) => toBlocks(p.course.id, p.course.code, p.picked).map((b) => ({ ...b, color: p.color })));
  const clashes = conflicts(blocks);
  const slot = (b: { section: Section; day: number; start: number }) => `${b.section.code}|${b.day}|${b.start}`;
  const show = (b: Block & { color: string }) => {
    keep();
    setHover((h) => (h?.pinned ? h : { slot: slot(b), block: b, pinned: false }));
  };
  const keep = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };
  // A short delay so the pointer can move from a class onto its card (to click links).
  const hideSoon = () => {
    keep();
    hideTimer.current = setTimeout(() => setHover((h) => (h?.pinned ? h : null)), 200);
  };
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
        <span className="text-sm text-muted">{unitsPlanned} units</span>
      </div>
      <div className="pt-3">{searchBar(blocks)}</div>

      <div className="flex px-4 pt-4">
        <div className="inline-flex rounded-lg bg-subtle p-1 text-sm" role="tablist" aria-label="Schedule view">
          {([["classes", "Course schedule"], ["finals", "Finals schedule"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={`rounded-md px-4 py-1.5 font-medium ${mode === key ? "bg-surface text-brand shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "classes" && clashes.length > 0 && (
        <p className="mx-4 mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">
          ⚠ Time conflict: {[...new Set(clashes.map(([a, b]) => `${a.label} ${a.section.type} and ${b.label} ${b.section.type}`))].join("; ")}. Pick a different section below.
        </p>
      )}

      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_18rem]">
        {mode === "finals" && <FinalsList picks={picks} term={term} loading={!sections} />}

        {/* Week grid */}
        <div className={`overflow-x-auto ${mode === "finals" ? "hidden" : ""}`}>
          <div className="relative grid min-w-[36rem] grid-cols-[3rem_repeat(5,1fr)]" style={{ height: (END - START) * PX_PER_MIN + 24 }}>
            <div />
            {DAYS.map((d) => <div key={d} className="text-center text-xs font-semibold text-muted">{d}</div>)}
            {Array.from({ length: (END - START) / 60 + 1 }, (_, h) => (
              <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ top: 24 + h * 60 * PX_PER_MIN }}>
                <span className="absolute -top-2 left-0 bg-surface pr-1 text-[10px] text-muted">{clock(START + h * 60).replace(":00", "")}</span>
              </div>
            ))}
            {[0, 1, 2, 3, 4].flatMap((day) => layoutLanes(blocks.filter((b) => b.day === day && b.end > START && b.start < END))).map((b, i) => (
              <button
                type="button"
                key={`${b.section.code}-${b.day}-${i}`}
                onMouseEnter={() => show(b)}
                onMouseLeave={hideSoon}
                onFocus={() => show(b)}
                onBlur={hideSoon}
                onClick={() => (hover?.slot === slot(b) && hover.pinned ? setHover(null) : setHover({ slot: slot(b), block: b, pinned: true }))}
                aria-label={`${b.label} ${b.section.type} ${clock(b.start)} to ${clock(b.end)}. Show details`}
                className={`absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[10px] leading-tight text-white shadow-sm focus-visible:outline-2 focus-visible:outline-foreground ${clashing.has(slot(b)) ? "ring-2 ring-red-500 ring-offset-1" : ""}`}
                style={{
                  top: 24 + (Math.max(b.start, START) - START) * PX_PER_MIN,
                  height: Math.max(18, (Math.min(b.end, END) - Math.max(b.start, START)) * PX_PER_MIN - 2),
                  // overlapping classes share the day column side by side
                  left: `calc(3rem + (100% - 3rem) * ${b.day} / 5 + (100% - 3rem) / 5 * ${b.lane} / ${b.lanes} + 2px)`,
                  width: `calc((100% - 3rem) / 5 / ${b.lanes} - 4px)`,
                  background: b.color,
                }}
              >
                <p className="font-semibold">{b.label} <span className="font-normal opacity-90">{b.section.type}</span></p>
                <p className="opacity-90">{clock(b.start)}–{clock(b.end)}</p>
                {b.place && <p className="opacity-90">{b.place}</p>}
              </button>
            ))}
            {hover && (
              <ClassCard
                block={hover.block}
                course={courses.find((c) => c.id === hover.block.courseId)}
                style={{
                  top: 24 + (Math.max(hover.block.start, START) - START) * PX_PER_MIN,
                  ...(hover.block.day >= 3 ? { right: `calc((100% - 3rem) * ${5 - hover.block.day} / 5 + 4px)` } : { left: `calc(3rem + (100% - 3rem) * ${hover.block.day + 1} / 5 + 4px)` }),
                }}
                onEnter={keep}
                onLeave={hideSoon}
                onClose={() => setHover(null)}
              />
            )}
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

const STATUS_TONE: Record<string, string> = { OPEN: "text-emerald-700", FULL: "text-red-700", Waitl: "text-warn-ink", NewOnly: "text-warn-ink" };
const DAY_NAMES = ["M", "Tu", "W", "Th", "F", "Sa", "Su"];

// Everything from the class's WebSoc row, plus UCI's average GPA and a link to the instructor on
// RateMyProfessors (a link only: RMP's terms don't allow copying their ratings).
function ClassCard({ block, course, style, onEnter, onLeave, onClose }: {
  block: Block & { color: string };
  course?: CalendarCourse;
  style: React.CSSProperties;
  onEnter: () => void;
  onLeave: () => void;
  onClose: () => void;
}) {
  const s = block.section;
  const instructor = s.instructors[0];
  const [gpa, setGpa] = useState<{ key: string; info: GpaInfo | null } | null>(null);
  const key = `${block.label}|${instructor ?? ""}`;
  useEffect(() => {
    let cancelled = false;
    fetchGpa(block.label, instructor).then((info) => !cancelled && setGpa({ key, info }));
    return () => {
      cancelled = true;
    };
  }, [block.label, instructor, key]);
  const g = gpa?.key === key ? gpa : null;

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid grid-cols-[6.5rem_1fr] gap-2 py-0.5">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
  return (
    <div
      role="dialog"
      aria-label={`${block.label} ${s.type} details`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="absolute z-20 w-72 rounded-xl border border-border bg-surface p-3 text-left text-xs text-foreground shadow-xl"
      style={style}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <a href={catalogueUrl(block.label)} target="_blank" rel="noreferrer" className="font-mono text-sm font-semibold hover:text-brand hover:underline" style={{ color: block.color }}>{block.label}</a>
          {course && <p className="text-muted">{course.title}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded px-1 text-base leading-none text-muted hover:text-foreground">×</button>
      </div>
      <dl className="mt-2 border-t border-border pt-2">
        {row("Code", <span className="font-mono font-semibold">{s.code}</span>)}
        {row("Type", `${s.type}${s.num ? ` · Sec ${s.num}` : ""}${s.units ? ` · ${s.units} units` : ""}`)}
        {row("Instructor", instructor ? (
          <span>
            {s.instructors.join(", ")}
            <a href={rateMyProfessorsUrl(instructor)} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 font-medium text-brand hover:underline" title="Opens RateMyProfessors">
              <span aria-hidden className="text-amber-500">★</span> See ratings on RateMyProfessors ↗
            </a>
          </span>
        ) : "Staff")}
        {row("Avg GPA", !g ? "…" : g.info ? `${g.info.gpa.toFixed(2)}${g.info.byInstructor ? ` with ${instructor?.split(",")[0]}` : " (all instructors)"} · ${g.info.sections} past section${g.info.sections === 1 ? "" : "s"}${g.info.asCode ? ` as ${g.info.asCode}` : ""}` : "No grade data yet")}
        {row("Times", s.meetings.length ? s.meetings.map((m) => `${m.days.map((d) => DAY_NAMES[d]).join("")} ${clock(m.start)}–${clock(m.end)}`).join(", ") : "TBA")}
        {row("Place", s.meetings.map((m) => m.place).filter(Boolean).join(", ") || "TBA")}
        {s.capacity !== undefined && row("Enrollment", `${s.enrolled} / ${s.capacity}${s.waitlist ? ` · WL ${s.waitlist}` : ""}`)}
        {row("Status", <span className={`font-semibold ${STATUS_TONE[s.status] ?? ""}`}>{s.status === "Waitl" ? "Waitlist" : s.status === "NewOnly" ? "New students only" : s.status}</span>)}
        {s.restrictions && row("Restrictions", <a href={RESTRICTION_CODES} target="_blank" rel="noreferrer" className="text-brand hover:underline">{s.restrictions} ↗</a>)}
        {s.finalExam && row("Final", s.finalExam)}
        {s.syllabus && row("Syllabus", <a href={s.syllabus} target="_blank" rel="noreferrer" className="text-brand hover:underline">Open ↗</a>)}
      </dl>
    </div>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Finals week for the chosen sections, grouped by day, with exams at the same time flagged.
function FinalsList({ picks, term, loading }: {
  picks: { course: CalendarCourse; color: string; picked: Section[] }[];
  term: string;
  loading: boolean;
}) {
  const { dated, undated, clashes } = finalsSchedule(picks.map((p) => ({ courseId: p.course.id, label: p.course.code, sections: p.picked })));
  const colorOf = new Map(picks.map((p) => [p.course.id, p.color]));
  const titleOf = new Map(picks.map((p) => [p.course.id, p.course.title]));
  const clashing = new Set(clashes.flatMap(([a, b]) => [a.courseId, b.courseId]));
  const days = new Map<string, typeof dated>();
  for (const r of dated) {
    const key = `${r.final!.weekday} ${MONTHS[r.final!.month]} ${r.final!.day}`;
    days.set(key, [...(days.get(key) ?? []), r]);
  }
  if (loading) return <p className="text-sm text-muted">Loading finals…</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">Final exams for the sections you picked{term ? ` (${term})` : ""}. Finals follow the lecture, so changing a lecture section can change its final.</p>
      {clashes.length > 0 && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700">
          ⚠ Finals at the same time: {clashes.map(([a, b]) => `${a.label} and ${b.label}`).join("; ")}. Ask your instructors about a make-up, or pick other sections.
        </p>
      )}
      {[...days].map(([day, rows]) => (
        <section key={day} aria-label={day}>
          <h3 className="text-sm font-semibold">{day}</h3>
          <ul className="mt-2 space-y-2">
            {rows.map((r) => (
              <li key={r.courseId} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${clashing.has(r.courseId) ? "border-red-500/60 bg-red-500/5" : "border-border"}`}>
                <span aria-hidden className="h-8 w-1 shrink-0 rounded-full" style={{ background: colorOf.get(r.courseId) }} />
                <span className="w-36 shrink-0 tabular-nums">{clock(r.final!.start)}–{clock(r.final!.end)}</span>
                <span className="min-w-0 flex-1 truncate"><span className="font-mono text-xs font-semibold">{r.label}</span> · {titleOf.get(r.courseId)}</span>
                <span className="shrink-0 text-muted">{r.final!.place || "Room TBA"}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {undated.length > 0 && (
        <section aria-label="No scheduled final">
          <h3 className="text-sm font-semibold text-muted">No scheduled final</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {undated.map((r) => <li key={r.courseId}><span className="font-mono text-xs font-semibold">{r.label}</span> · {r.note}</li>)}
          </ul>
        </section>
      )}
      {!dated.length && !undated.length && <p className="text-sm text-muted">No classes yet. Add some with the search above.</p>}
    </div>
  );
}
