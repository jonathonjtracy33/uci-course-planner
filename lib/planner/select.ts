// Turns a major's requirement tree into a concrete set of courses, preferring options that are
// already in the plan or drag in the fewest extra prerequisites.
import type { Requirement } from "@/db/schema";
import { courseCost, type PrereqContext } from "./prereqs";
import type { Catalog } from "./types";

export type Selection = {
  courses: Map<string, string>; // course id -> reason it was chosen
  repeats: Map<string, number>; // course id -> extra times it's taken (e.g. "DRAMA 145, taken 3 times")
  placeholders: { title: string; units: number; reason: string }[];
  warnings: string[];
};

const PLACEHOLDER_UNITS = 4;

export const unitsOf = (c: { minUnits: number; maxUnits: number }) => (c.minUnits > 0 ? c.minUnits : c.maxUnits);

function clone(s: Selection): Selection {
  return { courses: new Map(s.courses), repeats: new Map(s.repeats), placeholders: [...s.placeholders], warnings: [...s.warnings] };
}

// How much a selection "weighs": every course plus everything its prerequisites drag in.
function weight(s: Selection, catalog: Catalog, completed: Set<string>, exams: Set<string>): number {
  const ctx: PrereqContext = { catalog, have: new Set(completed), exams };
  const memo = new Map<string, number>();
  let total = s.placeholders.length + [...s.repeats.values()].reduce((a, b) => a + b, 0);
  for (const id of s.courses.keys()) {
    const c = courseCost(id, ctx, memo);
    total += Number.isFinite(c) ? c : 1;
  }
  return total;
}

export function selectCourses(requirements: Requirement[], catalog: Catalog, completed: Set<string>, exams: Set<string>): Selection {
  const selection: Selection = { courses: new Map(), repeats: new Map(), placeholders: [], warnings: [] };
  for (const req of requirements) apply(req, selection, catalog, completed, exams);
  return selection;
}

function apply(req: Requirement, sel: Selection, catalog: Catalog, completed: Set<string>, exams: Set<string>) {
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

  if (req.requirementType === "Course") {
    let need = req.courseCount - options.filter((id) => owned.has(id)).length;
    for (const { id } of candidates) {
      if (need <= 0) break;
      sel.courses.set(id, reason);
      need--;
    }
    need = repeat(options, need, () => 1, sel);
    if (need > 0 && options.length === 0) {
      // e.g. "Specify a specialization": the catalog leaves the choice to the student
      for (let i = 0; i < need; i++) sel.placeholders.push({ title: req.label, units: PLACEHOLDER_UNITS, reason });
    } else if (need > 0) {
      sel.warnings.push(`Couldn't find enough courses for "${req.label}"`);
    }
    return;
  }

  // Unit requirement: keep adding courses until the unit count is met.
  let need = req.unitCount - options.filter((id) => owned.has(id)).reduce((sum, id) => sum + unitsOf(catalog.get(id)!), 0);
  for (const { id } of candidates) {
    if (need <= 0) break;
    sel.courses.set(id, reason);
    need -= unitsOf(catalog.get(id)!);
  }
  need = repeat(options, need, (id) => unitsOf(catalog.get(id)!), sel);
  while (need > 0 && options.length === 0) {
    sel.placeholders.push({ title: req.label, units: PLACEHOLDER_UNITS, reason });
    need -= PLACEHOLDER_UNITS;
  }
  if (need > 0 && options.length > 0) sel.warnings.push(`Couldn't find enough units for "${req.label}"`);
}

// Every option is already used but the requirement wants more ("8 units of DRAMA 101",
// "taken 3 times"): the courses must be repeatable, so take them again in order.
function repeat(options: string[], need: number, size: (id: string) => number, sel: Selection): number {
  for (let i = 0; need > 0 && options.length && i < 20; i++) {
    const id = options[i % options.length];
    if (!sel.courses.has(id)) continue; // a completed course; only plan repeats of planned ones
    sel.repeats.set(id, (sel.repeats.get(id) ?? 0) + 1);
    need -= size(id);
  }
  return need;
}
