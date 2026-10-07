"use client";

import { useState } from "react";
import type { ApExam } from "@/lib/planner/ap";
import { UNIT_CHOICES, type PlanSettings } from "@/lib/plan-settings";
import { CourseSearch } from "./course-search";
import type { CourseFacts } from "./plan-view";
import type { CourseIndex } from "./use-course-index";

const SEASONS = ["Fall", "Winter", "Spring"] as const;
const quarterLabel = (entryYear: number, q: number) => {
  const season = SEASONS[q % 3];
  return `${season} ${entryYear + Math.floor(q / 3) + (season === "Fall" ? 0 : 1)}`;
};

const field = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

export function SettingsPanel({ settings, update, defaultEntryYear, factsOf, index, onSearchFocus, apExams, onReset }: {
  settings: PlanSettings;
  update: (change: Partial<PlanSettings>) => void;
  defaultEntryYear: number;
  factsOf: (id: string) => CourseFacts | null;
  index: CourseIndex | null;
  onSearchFocus: () => void;
  apExams: ApExam[];
  onReset: () => void;
}) {
  const [exam, setExam] = useState("");
  const [score, setScore] = useState(5);
  const [copied, setCopied] = useState(false);

  const entryYears = Array.from({ length: 8 }, (_, i) => defaultEntryYear - 6 + i);
  const codeOf = (id: string) => factsOf(id)?.code ?? id;
  const customized = settings.taken.length > 0 || Object.keys(settings.ap).length > 0 || settings.added.length > 0 || settings.firstQuarter > 0 || settings.maxUnits !== 16 || settings.entryYear !== defaultEntryYear;

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section aria-labelledby="customize" className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="customize" className="text-sm font-semibold">Make it yours</h2>
        <div className="flex gap-2">
          {customized && <button type="button" onClick={onReset} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-foreground">Reset</button>}
          <button type="button" onClick={copyLink} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110">
            {copied ? "Link copied ✓" : "Copy share link"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted">
          Started at UCI
          <select className={`${field} mt-1`} value={settings.entryYear} onChange={(e) => update({ entryYear: Number(e.target.value) })}>
            {entryYears.map((y) => <option key={y} value={y}>Fall {y}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Plan starting
          <select className={`${field} mt-1`} value={settings.firstQuarter} onChange={(e) => update({ firstQuarter: Number(e.target.value) })}>
            {Array.from({ length: 12 }, (_, q) => <option key={q} value={q}>{quarterLabel(settings.entryYear, q)} (year {Math.floor(q / 3) + 1})</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Max major units per quarter
          <select className={`${field} mt-1`} value={settings.maxUnits} onChange={(e) => update({ maxUnits: Number(e.target.value) })}>
            {UNIT_CHOICES.map((u) => <option key={u} value={u}>{u} units</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted">AP exams</p>
          <form
            className="mt-1 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (exam) update({ ap: { ...settings.ap, [exam]: score } });
              setExam("");
            }}
          >
            <select aria-label="AP exam" className={field} value={exam} onChange={(e) => setExam(e.target.value)}>
              <option value="">Choose an exam…</option>
              {apExams.map((x) => <option key={x.name} value={x.name}>{x.name.replace(/^AP /, "")}</option>)}
            </select>
            <select aria-label="Score" className={`${field} w-20`} value={score} onChange={(e) => setScore(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" disabled={!exam} className="rounded-lg border border-border px-3 text-sm hover:border-brand hover:text-brand disabled:opacity-40">Add</button>
          </form>
          <Chips
            items={Object.entries(settings.ap).map(([name, s]) => ({ key: name, label: `${name.replace(/^AP /, "")} · ${s}` }))}
            onRemove={(name) => update({ ap: Object.fromEntries(Object.entries(settings.ap).filter(([n]) => n !== name)) })}
          />
        </div>

        <div>
          <p className="text-xs font-medium text-muted">Courses already taken</p>
          <div className="mt-1">
            <CourseSearch
              index={index}
              onFocus={onSearchFocus}
              onPick={(c) => update({ taken: [...new Set([...settings.taken, c.id])] })}
              placeholder="Search any UCI course, e.g. WRITING 50"
            />
          </div>
          <Chips
            items={settings.taken.map((id) => ({ key: id, label: codeOf(id) }))}
            onRemove={(id) => update({ taken: settings.taken.filter((t) => t !== id) })}
            empty="Or select a course in the plan and choose “Mark as taken”."
          />
        </div>
      </div>
    </section>
  );
}

function Chips({ items, onRemove, empty }: { items: { key: string; label: string }[]; onRemove: (key: string) => void; empty?: string }) {
  if (!items.length) return empty ? <p className="mt-2 text-xs text-muted">{empty}</p> : null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1 rounded-full bg-brand-soft py-0.5 pl-2.5 pr-1 text-xs">
          <span className="font-mono">{i.label}</span>
          <button type="button" onClick={() => onRemove(i.key)} aria-label={`Remove ${i.label}`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-background hover:text-foreground">×</button>
        </li>
      ))}
    </ul>
  );
}
