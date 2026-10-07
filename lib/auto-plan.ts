// Fills a plan's open space automatically: GEs first (planGes), then free electives up to the
// 180 units a degree needs (fillElectives). Both are greedy, quarter by quarter, so earlier
// choices count as done when later quarters check prerequisites.
import { geProgress, type GeCourse } from "./ge";
import { recommendGes, type GeCandidate } from "./ge-recommend";
import type { Season } from "./planner";

export type QuarterSlot = { index: number; season: Season; units: number; courseIds: string[] };
export type Added = { id: string; quarter: number };

export function planGes(input: {
  quarters: QuarterSlot[]; // quarters to fill, in order
  candidates: GeCandidate[];
  known: GeCourse[]; // courses already counting toward GEs (taken, AP, major, added)
  apGe: Record<string, number>;
  have: Set<string>; // taken or credited before the first quarter
  exams: Map<string, number>;
  majorName: string;
  perQuarter: number; // most GEs to add in one quarter
  fullLoad: number; // units in a typical full quarter
}): Added[] {
  const byId = new Map(input.candidates.map((c) => [c.id, c]));
  const added: Added[] = [];
  const earlier = new Set(input.have);

  for (const q of input.quarters) {
    const progress = geProgress([...input.known, ...added.map((a): GeCourse => ({ id: a.id, ge: byId.get(a.id)?.ge ?? [], status: "planned" }))], input.apGe);
    const openUnits = input.fullLoad - q.units;
    const limit = Math.min(input.perQuarter, Math.floor(openUnits / 4));
    if (limit > 0) {
      const picks = recommendGes({
        candidates: input.candidates,
        progress,
        season: q.season,
        student: { have: earlier, sameQuarter: new Set(q.courseIds), exams: input.exams },
        standing: { year: Math.min(4, Math.floor(q.index / 3) + 1), majorName: input.majorName },
        exclude: new Set([...input.known.map((k) => k.id), ...added.map((a) => a.id)]),
        openUnits,
        limit,
      })
        // only courses the student can actually take that quarter, and no upper division in year 1
        .filter((r) => r.missing.length === 0 && r.restriction.kind !== "priority" && !(r.course.number >= 100 && q.index < 3));
      for (const r of picks) added.push({ id: r.course.id, quarter: q.index });
    }
    for (const id of q.courseIds) earlier.add(id);
    for (const a of added) if (a.quarter === q.index) earlier.add(a.id);
  }
  return added;
}

// Spreads free-elective slots over the lightest quarters until the plan reaches `gap` more units.
// Quarters stay at or under `softCap` while any room is left, and never go past `hardCap`.
// Ties go to later quarters, where students usually have more room for electives.
export function fillElectives(quarters: { index: number; units: number }[], gap: number, opts = { size: 4, softCap: 16, hardCap: 20 }): Map<number, number> {
  const load = new Map(quarters.map((q) => [q.index, q.units]));
  const slots = new Map<number, number>();
  for (let left = gap; left > 0; left -= opts.size) {
    const pick = (cap: number) =>
      [...load].filter(([, u]) => u + opts.size <= cap).sort((a, b) => a[1] - b[1] || b[0] - a[0])[0]?.[0];
    const q = pick(opts.softCap) ?? pick(opts.hardCap);
    if (q === undefined) break;
    load.set(q, load.get(q)! + opts.size);
    slots.set(q, (slots.get(q) ?? 0) + 1);
  }
  return slots;
}
