// Builds a 4-year plan for a major:
//   1. select   - pick concrete courses that satisfy each major requirement
//   2. close    - pull in every prerequisite those courses need (transitively)
//   3. schedule - topologically sort them into quarters under unit and offering limits
import type { Requirement } from "@/db/schema";
import { resolveTree, type PrereqContext } from "./prereqs";
import { schedule } from "./schedule";
import { selectCourses, unitsOf } from "./select";
import type { Catalog, Plan, PlanOptions, PlannedItem } from "./types";

export * from "./types";

const displayId = (id: string, catalog: Catalog) => {
  const c = catalog.get(id);
  return c ? c.id.replace(/^(.*?)(\d.*)$/, "$1 $2") : id;
};

export function buildPlan(requirements: Requirement[], catalog: Catalog, options: PlanOptions): Plan {
  const completed = new Set(options.completed ?? []);
  const exams = new Map(Object.entries(options.exams ?? {}).map(([name, score]) => [name.toUpperCase(), score]));
  const selection = selectCourses(requirements, catalog, completed, exams);

  // Close over prerequisites. Courses picked for the major are already "in the plan", so an
  // OR-prerequisite will reuse them instead of adding something new.
  const reasons = new Map(selection.courses);
  const requisites = new Map<string, { prereqs: string[]; coreqs: string[] }>();
  const queue = [...reasons.keys()];
  while (queue.length) {
    const id = queue.shift()!;
    const ctx: PrereqContext = { catalog, have: new Set([...completed, ...reasons.keys()]), exams };
    const needed = resolveTree(catalog.get(id)!.prerequisiteTree, ctx).filter((r) => !completed.has(r.id) && r.id !== id);
    requisites.set(id, {
      prereqs: needed.filter((r) => !r.coreq).map((r) => r.id),
      coreqs: needed.filter((r) => r.coreq).map((r) => r.id),
    });
    for (const r of needed) {
      if (reasons.has(r.id)) continue;
      reasons.set(r.id, `Prerequisite for ${displayId(id, catalog)}`);
      queue.push(r.id);
    }
  }

  const items: PlannedItem[] = [...reasons].map(([id, reason]) => {
    const c = catalog.get(id)!;
    return { id, title: c.title, units: unitsOf(c), reason, ...requisites.get(id)! };
  });
  // Repeats are separate items ("DRAMA101#2"), each one quarter after the previous.
  for (const [id, extra] of selection.repeats) {
    const first = items.find((i) => i.id === id)!;
    for (let n = 2; n <= extra + 1; n++)
      items.push({ ...first, id: `${id}#${n}`, reason: `${first.reason} (repeat ${n})`, prereqs: [...first.prereqs, n === 2 ? id : `${id}#${n - 1}`] });
  }
  selection.placeholders.forEach((p, n) =>
    items.push({ id: `placeholder:${n}`, title: p.title, units: p.units, reason: p.reason, placeholder: true, prereqs: [], coreqs: [] }));

  const quarters = options.quarters ?? 12;
  const firstQuarter = options.firstQuarter ?? 0;
  const maxUnits = options.maxUnitsPerQuarter ?? 16;
  const run = (cap: number) => schedule(items, catalog, {
    startYear: options.startYear,
    firstQuarter,
    maxUnitsPerQuarter: cap,
    quarters,
    maxQuarters: options.maxQuarters ?? 18,
    offeredSince: options.offeredSince ?? options.startYear - 4,
  });
  const fits = (r: ReturnType<typeof run>) => r.quarters.every((q) => q.index < quarters) && r.unscheduled.length === 0;

  // Balancing: use the lightest per-quarter major load that still finishes on time, so the
  // plan isn't front-loaded and every quarter keeps room for GEs.
  let cap = maxUnits;
  let result = run(maxUnits);
  if (options.balance !== false && fits(result)) {
    const total = items.reduce((sum, i) => sum + i.units, 0);
    for (let c = Math.max(4, Math.ceil(total / Math.max(1, quarters - firstQuarter))); c < maxUnits; c++) {
      const attempt = run(c);
      if (fits(attempt)) {
        [cap, result] = [c, attempt];
        break;
      }
    }
  }
  const { quarters: scheduled, unscheduled } = result;

  const warnings = [...selection.warnings];
  if (requirements.length === 0) warnings.push("UCI's catalog data doesn't list any requirements for this major yet.");
  const last = scheduled.at(-1);
  if (last && last.index >= quarters) warnings.push(`This plan runs to ${last.label}, past ${quarters / 3} years. Adding AP credit or courses you've already taken, or raising the unit limit, may shorten it.`);
  if (unscheduled.length) warnings.push(`${unscheduled.length} course(s) couldn't be scheduled.`);
  return { quarters: scheduled, majorUnitsPerQuarter: cap, unscheduled, warnings };
}
