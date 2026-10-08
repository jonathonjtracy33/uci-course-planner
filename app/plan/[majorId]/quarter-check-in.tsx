"use client";

import { useEffect, useRef, useState } from "react";
import { fetchTermDates, formatDate, quarterIsOver } from "@/lib/term-dates";

export type CheckInCourse = { id: string; code: string; title: string; units: number };

const SNOOZE_KEY = "degreepath:check-in-snoozed"; // quarter labels the student said "ask me later" to, this session

// Once a planned quarter's finals are over, ask which classes the student passed. Checked ones
// become completed and the plan moves on to the next quarter; unchecked ones (not passed or
// dropped) stay in the plan to be taken again.
export function QuarterCheckIn({ label, courses, onSubmit }: {
  label: string; // "Winter 2027"
  courses: CheckInCourse[];
  onSubmit: (passed: string[], notPassed: string[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [over, setOver] = useState<{ label: string; finalsEnd: string } | null>(null);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let snoozed: string[] = [];
    try {
      snoozed = JSON.parse(sessionStorage.getItem(SNOOZE_KEY) ?? "[]");
    } catch {
      // storage unavailable: just ask
    }
    if (snoozed.includes(label)) return;
    fetchTermDates(label).then((dates) => {
      if (!cancelled && dates && quarterIsOver(dates, new Date())) setOver({ label, finalsEnd: dates.finalsEnd });
    });
    return () => {
      cancelled = true;
    };
  }, [label]);

  useEffect(() => {
    if (over?.label === label && courses.length) dialog.current?.showModal();
  }, [over, label, courses.length]);

  if (over?.label !== label || !courses.length) return null;

  const snooze = () => {
    try {
      const list = JSON.parse(sessionStorage.getItem(SNOOZE_KEY) ?? "[]");
      sessionStorage.setItem(SNOOZE_KEY, JSON.stringify([...list, label]));
    } catch {
      // fine: it just asks again next time
    }
    dialog.current?.close();
  };
  const toggle = (id: string) => setFailed((f) => {
    const next = new Set(f);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const passed = courses.filter((c) => !failed.has(c.id));

  return (
    <dialog
      ref={dialog}
      onCancel={snooze}
      aria-labelledby="check-in-title"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-6 text-foreground shadow-2xl backdrop:bg-black/40"
    >
      <p className="text-sm font-medium text-brand">Finals ended {formatDate(over.finalsEnd)} 🎉</p>
      <h2 id="check-in-title" className="mt-1 text-xl font-semibold tracking-tight">How did {label} go?</h2>
      <p className="mt-1 text-sm text-muted">
        Check the classes you passed. Leave a class unchecked if you didn&apos;t pass it or dropped it, and it&apos;ll stay in your plan to take again.
      </p>
      <ul className="mt-4 space-y-2">
        {courses.map((c) => (
          <li key={c.id}>
            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${failed.has(c.id) ? "border-border" : "border-brand bg-brand-soft"}`}>
              <input type="checkbox" checked={!failed.has(c.id)} onChange={() => toggle(c.id)} className="size-4 accent-[var(--brand)]" />
              <span className="min-w-0 flex-1 truncate"><span className="font-mono text-xs font-semibold">{c.code}</span> · {c.title}</span>
              <span className="shrink-0 text-xs text-muted">{c.units}u</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{passed.reduce((s, c) => s + c.units, 0)} units will be added to your progress.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={snooze} className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">Ask me later</button>
        <button
          type="button"
          onClick={() => {
            onSubmit(passed.map((c) => c.id), courses.filter((c) => failed.has(c.id)).map((c) => c.id));
            dialog.current?.close();
          }}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          Save and plan my next quarter
        </button>
      </div>
    </dialog>
  );
}
