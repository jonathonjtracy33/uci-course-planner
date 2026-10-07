// Turns a major's requirement tree into a concrete set of courses, preferring options that are
// already in the plan or drag in the fewest extra prerequisites.
import type { Requirement } from "@/db/schema";
import { courseCost, type PrereqContext } from "./prereqs";
import type { Catalog } from "./types";

export type Selection = {
  courses: Map<string, string>; // course id -> reason it was chosen
  repeats: Map<string, number>; // course id -> extra times it's taken (e.g. "DRAMA 145, taken 3 times")
  used: Map<string, number>; // course id -> times already counted toward a requirement
  placeholders: { title: string; units: number; reason: string }[];
  warnings: string[];
};

const PLACEHOLDER_UNITS = 4;

export const unitsOf = (c: { minUnits: number; maxUnits: number }) => (c.minUnits > 0 ? c.minUnits : c.maxUnits);

function clone(s: Selection): Selection {
  return { courses: new Map(s.courses), repeats: new Map(s.repeats), used: new Map(s.used), placeholders: [...s.placeholders], warnings: [...s.warnings] };
}

// How much a selection "weighs": every course plus everything its prerequisites drag in.
function weight(s: Selection, catalog: Catalog, completed: Set<string>, exams: Map<string, number>): number {
  const ctx: PrereqContext = { catalog, have: new Set(completed), exams };
  const memo = new Map<string, number>();
  let total = s.placeholders.length + [...s.repeats.values()].reduce((a, b) => a + b, 0);
  for (const id of s.courses.keys()) {
    const c = courseCost(id, ctx, memo);
    total += Number.isFinite(c) ? c : 1;
  }
  return total;
}

export function selectCourses(requirements: Requirement[], catalog: Catalog, completed: Set<string>, exams: Map<string, number>): Selection {
  const selection: Selection = { courses: new Map(), repeats: new Map(), used: new Map(), placeholders: [], warnings: [] };
  for (const req of requirements) apply(req, selection, catalog, completed, exams);
  return selection;
}

function apply(req: Requirement, sel: Selection, catalog: Catalog, completed: Set<string>, exams: Map<string, number>) {
  const reason = `Major: ${req.label}`;
  const have = () => new Set([...completed, ...sel.courses.keys()]);

  if (req.requirementType === "Group") {
    // Try each sub-requirement on a scratch copy and keep the cheapest `requirementCount` of them.
    const base = weight(sel, catalog, completed, exams);
    const ranked = req.requirements
      .map((sub, order) => {
        const trial = clone(sel);
        apply(sub, trial, catalog, completed, exams);
        return { sub, order, cost: weight(trial, catalog, completed, exams) - base };
      })
      .sort((a, b) => a.cost - b.cost || a.order - b.order);
    if (ranked.length < req.requirementCount) sel.warnings.push(`"${req.label}" lists fewer options than it requires`);
    for (const { sub } of ranked.slice(0, req.requirementCount)) apply(sub, sel, catalog, completed, exams);
    return;
  }

  const options = req.courses.filter((id) => catalog.has(id));
  const owned = have();
  const ctx: PrereqContext = { catalog, have: owned, exams };
  const memo = new Map<string, number>();
  const candidates = options
    .filter((id) => !owned.has(id))
    .map((id, order) => ({ id, order, cost: courseCost(id, ctx, memo) }))
    .sort((a, b) => a.cost - b.cost || a.order - b.order);
  const size = req.requirementType === "Course" ? () => 1 : (id: string) => unitsOf(catalog.get(id)!);

  // Courses the student already has count toward this requirement. A non-repeatable course may
  // also count toward another requirement; a repeatable one only counts for as many times as it's
  // taken, so "3 more sections of DRAMA 81" really adds three.
  let need = req.requirementType === "Course" ? req.courseCount : req.unitCount;
  for (const id of options) {
    if (!owned.has(id) || need <= 0) continue;
    if (maxTimesOf(id, catalog) === 1) need -= size(id);
    else
      for (let free = timesTaken(id, sel, completed) - (sel.used.get(id) ?? 0); free > 0 && need > 0; free--) {
        sel.used.set(id, (sel.used.get(id) ?? 0) + 1);
        need -= size(id);
      }
  }

  for (const { id } of candidates) {
    if (need <= 0) break;
    sel.courses.set(id, reason);
    sel.used.set(id, (sel.used.get(id) ?? 0) + 1);
    need -= size(id);
  }
  need = repeat(options, need, size, sel, catalog);

  if (need > 0 && options.length === 0) {
    // e.g. "Specify a specialization" or "12 units of approved electives": the student chooses
    const slots = req.requirementType === "Course" ? need : Math.ceil(need / PLACEHOLDER_UNITS);
    for (let i = 0; i < slots; i++) sel.placeholders.push({ title: req.label, units: PLACEHOLDER_UNITS, reason });
  } else if (need > 0) {
    sel.warnings.push(`Couldn't find enough ${req.requirementType === "Course" ? "courses" : "units"} for "${req.label}"`);
  }
}

const maxTimesOf = (id: string, catalog: Catalog) => catalog.get(id)?.maxTimes ?? 1;
const timesTaken = (id: string, sel: Selection, completed: Set<string>) =>
  (completed.has(id) ? 1 : 0) + (sel.courses.has(id) ? 1 + (sel.repeats.get(id) ?? 0) : 0);

// Every option is already used but the requirement wants more ("8 units of DRAMA 101",
// "3 sections of DRAMA 81"): take repeatable planned courses again, up to their limit. A
// requirement that names a single course several times ("2 quarters of ARTHIS 198") says it's
// repeatable even when the course data doesn't.
function repeat(options: string[], need: number, size: (id: string) => number, sel: Selection, catalog: Catalog): number {
  const limit = (id: string) => (options.length === 1 ? Infinity : maxTimesOf(id, catalog));
  const repeatable = options.filter((id) => sel.courses.has(id) && limit(id) > 1);
  for (let progress = true; need > 0 && progress; ) {
    progress = false;
    for (const id of repeatable) {
      if (need <= 0) break;
      if (1 + (sel.repeats.get(id) ?? 0) >= limit(id)) continue;
      sel.repeats.set(id, (sel.repeats.get(id) ?? 0) + 1);
      sel.used.set(id, (sel.used.get(id) ?? 0) + 1);
      need -= size(id);
      progress = true;
    }
  }
  return need;
}
