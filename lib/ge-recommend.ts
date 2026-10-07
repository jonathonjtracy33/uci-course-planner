// Recommends GE courses for one quarter. A greedy set cover: each round scores every eligible
// course by how many still-open GE categories it fills (plus whether the student can actually take
// it), takes the best, counts its categories as filled, and repeats. So one course that fills II,
// Va and VIII beats three courses that each fill one, and later picks cover what's left.
import type { PrereqTree } from "@/db/schema";
import { GE_ALTERNATIVES, GE_CATEGORIES, V_TOTAL, type GeProgress } from "./ge";
import { courseStatus, type Missing, type StudentState } from "./prereq-status";
import { checkRestriction, type RestrictionCheck, type Standing } from "./restrictions";

export type GeCandidate = {
  id: string;
  code: string;
  title: string;
  units: number;
  ge: string[];
  seasons: string; // "FWS" letters, "*" any, "" not recent
  number: number;
  prerequisiteTree: PrereqTree | null;
  prerequisiteText: string | null;
  restriction: string | null;
  overlaps: string[]; // can't also get credit for these
};

export type Recommendation = {
  course: GeCandidate;
  fills: string[]; // GE codes it would fill
  missing: Missing[];
  restriction: RestrictionCheck;
  reasons: string[];
};

const numeral = (code: string) => GE_CATEGORIES.find((c) => c.code === code)?.numeral ?? code;

// Categories (by code) that still need courses, counting Category V's total as well.
function openNeeds(progress: GeProgress): Map<string, number> {
  const open = new Map<string, number>();
  for (const c of GE_CATEGORIES) {
    const p = progress[c.code];
    if (p.done + p.planned < c.need) open.set(c.code, c.need - p.done - p.planned);
  }
  const v = progress["GE-5"];
  if (v && v.done + v.planned < V_TOTAL) open.set("GE-5", V_TOTAL - v.done - v.planned);
  return open;
}

function fills(course: GeCandidate, open: Map<string, number>): string[] {
  const out = course.ge.filter((g) => g !== "GE-5A" && g !== "GE-5B" && (open.get(g) ?? 0) > 0);
  // A course in both Va and Vb fills one of them (and counts toward the V total).
  const v = ["GE-5A", "GE-5B"].filter((g) => course.ge.includes(g) && (open.get(g) ?? 0) > 0);
  if (v.length) out.push(v[0]);
  else if ((course.ge.includes("GE-5A") || course.ge.includes("GE-5B")) && (open.get("GE-5") ?? 0) > 0) out.push("GE-5");
  return out;
}

// True if the student already has (or plans) a course this one overlaps with, or a GE alternative
// to it, so taking it would earn no new credit.
export function redundant(c: Pick<GeCandidate, "id" | "overlaps">, owned: Set<string>): boolean {
  if (c.overlaps.some((id) => owned.has(id))) return true;
  return GE_ALTERNATIVES.some((group) => group.includes(c.id) && group.some((id) => id !== c.id && owned.has(id)));
}

export function recommendGes(input: {
  candidates: GeCandidate[];
  progress: GeProgress;
  season: "Fall" | "Winter" | "Spring";
  student: StudentState;
  standing: Standing;
  exclude: Set<string>;
  openUnits: number;
  limit?: number;
}): Recommendation[] {
  const open = openNeeds(input.progress);
  const usual = new Set(GE_CATEGORIES.flatMap((c) => c.usual ?? []));
  const offered = (c: GeCandidate) => c.seasons === "*" || c.seasons.includes(input.season[0]);
  const owned = new Set([...input.exclude, ...input.student.have]);
  const pool = input.candidates
    .filter((c) => !input.exclude.has(c.id) && c.seasons !== "" && offered(c) && !redundant(c, owned))
    .map((course) => ({
      course,
      status: courseStatus(course, input.student),
      restriction: checkRestriction(course.restriction, input.standing),
    }))
    .filter((c) => c.restriction.kind !== "blocked"); // never recommend something they can't enroll in

  const picks: Recommendation[] = [];
  let unitsLeft = input.openUnits;
  while (picks.length < (input.limit ?? 6)) {
    let best: { score: number; rec: Recommendation } | null = null;
    for (const c of pool) {
      if (picks.some((p) => p.course.id === c.course.id)) continue;
      const f = fills(c.course, open);
      if (!f.length) continue;
      const score =
        f.length * 10 +
        (f.includes("GE-1A") ? 5 : 0) + // lower-division writing has a deadline: the end of year 2
        (usual.has(c.course.id) ? 3 : 0) + // the catalogue's standard choice for its category
        (c.status.met ? 6 : -12) +
        (c.restriction.kind === "priority" ? -2 : 0) +
        (c.course.number < 100 ? 1 : 0) +
        (c.course.units <= unitsLeft ? 1 : -1);
      if (!best || score > best.score || (score === best.score && c.course.code < best.rec.course.code)) {
        best = { score, rec: { course: c.course, fills: f, missing: c.status.missing, restriction: c.restriction, reasons: [] } };
      }
    }
    if (!best) break;
    const rec = best.rec;
    rec.reasons.push(`Fills GE ${rec.fills.map((g) => (g === "GE-5" ? "V" : numeral(g))).join(", ")}`);
    rec.reasons.push(rec.missing.length ? "Prerequisites not met yet" : rec.course.prerequisiteTree ? "You've met the prerequisites" : "No prerequisites");
    if (rec.restriction.kind === "priority") rec.reasons.push("Others get enrollment priority");
    picks.push(rec);
    unitsLeft -= rec.course.units;
    for (const g of rec.fills) open.set(g, (open.get(g) ?? 0) - 1);
    if (rec.fills.some((g) => g === "GE-5A" || g === "GE-5B")) open.set("GE-5", (open.get("GE-5") ?? 0) - 1);
  }
  return picks;
}
