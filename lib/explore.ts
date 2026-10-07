// The Course Explorer's filtering: which courses a student could add to one quarter, and why or
// why not. "Ready" means offered that season, prerequisites done by then, not restricted away
// from them, and not something they already have or that overlaps it.
import type { GeProgress } from "./ge";
import { redundant, type GeCandidate } from "./ge-recommend";
import { courseStatus, type Missing, type StudentState } from "./prereq-status";
import { checkRestriction, type RestrictionCheck, type Standing } from "./restrictions";

export type ExploreFilters = {
  kind: "all" | "ge" | "elective"; // elective = not approved for any GE
  geCategory: string | null; // e.g. "GE-2"
  readyOnly: boolean;
  lowerDivisionOnly: boolean;
  noPriority: boolean; // hide courses where other students get enrollment priority
  query: string;
};

export type ExploreResult = {
  course: GeCandidate;
  missing: Missing[];
  restriction: RestrictionCheck;
  ready: boolean;
  fillsOpenGe: string[]; // GE categories it would fill that the student still needs
};

export function exploreCourses(input: {
  courses: Iterable<GeCandidate>;
  season: "Fall" | "Winter" | "Spring";
  student: StudentState;
  standing: Standing;
  owned: Set<string>; // taken, credited, or already planned
  progress: GeProgress;
  filters: ExploreFilters;
}): ExploreResult[] {
  const f = input.filters;
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  const openGe = (code: string) => {
    const p = input.progress[code];
    return !!p && p.done + p.planned < p.need;
  };
  const results: ExploreResult[] = [];
  for (const course of input.courses) {
    if (input.owned.has(course.id)) continue;
    if (course.seasons === "" || !(course.seasons === "*" || course.seasons.includes(input.season[0]))) continue;
    if (f.kind === "ge" && !course.ge.length) continue;
    if (f.kind === "elective" && course.ge.length) continue;
    if (f.geCategory && !course.ge.includes(f.geCategory)) continue;
    if (f.lowerDivisionOnly && course.number >= 100) continue;
    if (words.length && !words.every((w) => `${course.code} ${course.title}`.toLowerCase().includes(w))) continue;

    const status = courseStatus(course, input.student);
    const restriction = checkRestriction(course.restriction, input.standing);
    const ready = status.met && restriction.kind !== "blocked" && !redundant(course, input.owned);
    if (f.readyOnly && !ready) continue;
    if (f.noPriority && restriction.kind === "priority") continue;
    results.push({ course, missing: status.missing, restriction, ready, fillsOpenGe: course.ge.filter(openGe) });
  }
  // When searching, codes that start with the search come first ("math 2" -> MATH 2D before MATH 192).
  const q = f.query.toUpperCase().replace(/\s+/g, "");
  const codeMatch = (r: ExploreResult) => (q && r.course.code.toUpperCase().replace(/\s+/g, "").startsWith(q) ? 0 : 1);
  // Then best fit: ready, fills GE categories still needed, lower division, then by code.
  return results.sort((a, b) =>
    codeMatch(a) - codeMatch(b) ||
    Number(b.ready) - Number(a.ready) ||
    b.fillsOpenGe.length - a.fillsOpenGe.length ||
    Number(a.restriction.kind === "priority") - Number(b.restriction.kind === "priority") ||
    Number(a.course.number >= 100) - Number(b.course.number >= 100) ||
    a.course.code.localeCompare(b.course.code));
}
