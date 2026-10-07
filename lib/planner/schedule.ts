// Places planned items into quarters. This is a topological sort with resource limits
// ("list scheduling"): each quarter we take every item whose prerequisites are finished and
// that's usually offered that season, most urgent first, until the unit cap is reached.
import { termAt, termIndexes, type Catalog, type CatalogCourse, type PlannedItem, type Quarter, type Season } from "./types";

export type ScheduleOptions = {
  startYear: number;
  firstQuarter: number;
  maxUnitsPerQuarter: number;
  reserved: Record<number, number>; // units already used in each quarter by student-added courses
  quarters: number;
  maxQuarters: number;
  offeredSince: number;
  summers: boolean;
  summerUnits: number;
};

const SEASON_OF: Record<string, Season> = { Fall: "Fall", Winter: "Winter", Spring: "Spring", Summer1: "Summer", Summer2: "Summer", Summer10wk: "Summer" };

// Seasons a course has run in since `since`. null = not enough history to see a pattern (fewer than
// two academic years of offerings, e.g. a brand-new course), so assume any season.
export function offeredSeasons(terms: string[], since: number): Set<Season> | null {
  const seasons = new Set<Season>();
  const years = new Set<number>();
  for (const term of terms) {
    const [year, raw] = term.split(" ");
    const season = SEASON_OF[raw];
    if (Number(year) < since || !season) continue;
    seasons.add(season);
    years.add(season === "Fall" ? Number(year) : Number(year) - 1); // academic year starts in Fall
  }
  return years.size >= 2 ? seasons : null;
}

// Length of the longest chain of items that depend on `id`. Items at the head of long chains
// must go first or the plan stretches past 4 years.
function chainLengths(items: PlannedItem[]): Map<string, number> {
  const dependents = new Map<string, string[]>();
  for (const item of items)
    for (const p of [...item.prereqs, ...item.coreqs]) dependents.set(p, [...(dependents.get(p) ?? []), item.id]);

  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const length = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (visiting.has(id)) return 0; // cycle; the scheduler reports it as unschedulable
    visiting.add(id);
    const result = 1 + Math.max(0, ...(dependents.get(id) ?? []).map(length));
    visiting.delete(id);
    memo.set(id, result);
    return result;
  };
  return new Map(items.map((i) => [i.id, length(i.id)]));
}

// Class-standing rules live in free text, not the prerequisite tree, so approximate them:
// upper-division courses and elective slots wait for year 2, senior-only courses for senior year.
// Senior year is the last three quarters before graduation (year 4 when graduating on time, earlier
// for a student finishing early, since senior standing comes from units, not years).
export function earliestQuarter(item: PlannedItem, course?: CatalogCourse, graduateAt = 12): number {
  if (item.placeholder) return 3;
  if (!course) return 0;
  if (/seniors only/i.test(course.restriction ?? "") || /senior design|capstone/i.test(course.title)) return Math.max(3, Math.min(9, graduateAt - 3));
  if (/^Upper Division/.test(course.courseLevel ?? "")) return 3;
  return 0;
}

// "DRAMA101#2" (a repeat) shares its catalog entry with "DRAMA101".
export const baseId = (id: string) => id.split("#")[0];

export function schedule(items: PlannedItem[], catalog: Catalog, opts: ScheduleOptions) {
  const priority = chainLengths(items);
  const earliest = new Map(items.map((i) => [i.id, earliestQuarter(i, catalog.get(baseId(i.id)), opts.quarters)]));
  const seasons = new Map(items.map((i) => {
    const course = catalog.get(baseId(i.id));
    return [i.id, course ? offeredSeasons(course.terms, opts.offeredSince) : null];
  }));

  const remaining = new Map(items.map((i) => [i.id, i]));
  const done = new Set<string>(); // finished in an earlier quarter
  const quarters: Quarter[] = [];

  // q counts quarters since the student's first Fall, so class-standing rules stay correct
  // for a student who starts planning partway through. Summers (if planned) are half steps.
  for (const q of termIndexes(opts.firstQuarter, opts.maxQuarters, opts.summers)) {
    if (!remaining.size) break;
    const term = termAt(q, opts.startYear);
    const season = term.season;
    const quarter: Quarter = { ...term, items: [], units: 0 };
    const placed = new Set<string>();
    const cap = season === "Summer" ? Math.min(opts.summerUnits, opts.maxUnitsPerQuarter) : opts.maxUnitsPerQuarter;

    const canTake = (i: PlannedItem) =>
      i.prereqs.every((p) => done.has(p)) && q >= earliest.get(i.id)! &&
      // summer only for courses actually offered in summer; elective slots never go in summer
      (season === "Summer" ? !i.placeholder && !!seasons.get(i.id)?.has("Summer") : seasons.get(i.id)?.has(season) ?? true);

    // An item plus every not-yet-placed coreq it (transitively) needs. Coreqs that require each
    // other ("take A with B") have to be placed together or neither can ever go first.
    const coreqGroup = (item: PlannedItem): PlannedItem[] | null => {
      const group = new Map([[item.id, item]]);
      for (const member of group.values())
        for (const c of member.coreqs) {
          if (done.has(c) || placed.has(c) || group.has(c)) continue;
          const partner = remaining.get(c);
          if (!partner) return null;
          group.set(c, partner);
        }
      return [...group.values()].every(canTake) ? [...group.values()] : null;
    };

    // Repeat so a coreq placed this quarter can unlock its partner in the same quarter.
    for (let progress = true; progress; ) {
      progress = false;
      const ready = [...remaining.values()]
        .filter(canTake)
        .sort((a, b) =>
          Number(!!a.placeholder) - Number(!!b.placeholder) ||
          priority.get(b.id)! - priority.get(a.id)! ||
          // lower-division before upper-division
          earliest.get(a.id)! - earliest.get(b.id)! ||
          // rarely offered courses first, so they don't miss their only season
          (seasons.get(a.id)?.size ?? 3) - (seasons.get(b.id)?.size ?? 3) ||
          a.id.localeCompare(b.id));

      for (const item of ready) {
        if (!remaining.has(item.id)) continue; // already placed as part of an earlier coreq group
        const group = coreqGroup(item);
        if (!group) continue;
        const units = group.reduce((sum, i) => sum + i.units, 0);
        // Courses the student added count toward the limit too. A course bigger than the limit can
        // still go in an otherwise empty quarter.
        const used = quarter.units + (opts.reserved[q] ?? 0);
        if (used > 0 && used + units > cap) continue;
        for (const member of group) {
          quarter.items.push(member);
          placed.add(member.id);
          remaining.delete(member.id);
        }
        quarter.units += units;
        progress = true;
      }
    }

    placed.forEach((id) => done.add(id));
    quarters.push(quarter);
  }

  // Keep every quarter up to graduation even if the plan finishes early (empty summers aren't
  // worth showing); drop empty overflow quarters.
  const last = quarters.at(-1)?.index ?? opts.firstQuarter - 1;
  for (const q of termIndexes(opts.firstQuarter, opts.quarters, false)) if (q > last) quarters.push({ ...termAt(q, opts.startYear), items: [], units: 0 });
  for (let i = quarters.length - 1; i >= 0; i--) {
    const q = quarters[i];
    if (q.items.length === 0 && (q.season === "Summer" || q.index >= opts.quarters)) quarters.splice(i, 1);
    else if (q.index < opts.quarters) break;
  }
  // Summers in the middle that ended up empty aren't worth a column either.
  for (let i = quarters.length - 1; i >= 0; i--) if (quarters[i].season === "Summer" && quarters[i].items.length === 0) quarters.splice(i, 1);

  const unscheduled = [...remaining.values()].map((item) => {
    const waiting = [...item.prereqs, ...item.coreqs].filter((p) => !done.has(p));
    return {
      item,
      reason: waiting.length ? `Waiting on ${waiting.join(", ")}` : `Didn't fit within ${opts.maxQuarters} quarters`,
    };
  });

  return { quarters, unscheduled };
}
