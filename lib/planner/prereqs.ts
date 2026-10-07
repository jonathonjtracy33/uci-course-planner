// Prerequisite trees are AND/OR trees of course and exam leaves.
// We need two things from them: how "expensive" a tree is to satisfy (how many extra
// courses it drags in), and which concrete courses to add to satisfy it most cheaply.
import type { PrereqLeaf, PrereqTree } from "@/db/schema";
import type { Catalog } from "./types";

export const normalizeCourseId = (id: string) => id.replace(/\s+/g, "");

export type PrereqContext = {
  catalog: Catalog;
  have: Set<string>; // completed or already in the plan
  exams: Map<string, number>; // upper-cased exam name -> score
};

const isLeaf = (t: PrereqTree): t is PrereqLeaf => "prereqType" in t;

// Number of new courses needed to satisfy `tree`. Infinity means "can't be satisfied"
// (e.g. a retired course or an exam the student hasn't taken). Inside an AND an impossible
// branch is skipped rather than poisoning the whole course: the catalog is full of retired
// courses and placement exams, and refusing to plan those courses would help nobody.
export function treeCost(tree: PrereqTree | null, ctx: PrereqContext, memo = new Map<string, number>(), visiting = new Set<string>()): number {
  if (!tree) return 0;
  if (isLeaf(tree)) {
    if (tree.prereqType === "exam") return passed(tree.examName, tree.minGrade, ctx) ? 0 : Infinity;
    return courseCost(normalizeCourseId(tree.courseId), ctx, memo, visiting);
  }
  if ("AND" in tree) {
    const costs = tree.AND.map((t) => treeCost(t, ctx, memo, visiting));
    const possible = costs.filter(Number.isFinite);
    // Skip impossible parts (retired courses, placement exams), but if nothing is possible, the
    // whole requirement is (e.g. ICS H32's only prerequisite is an AP exam the student didn't take).
    return costs.length && !possible.length ? Infinity : possible.reduce((a, b) => a + b, 0);
  }
  if ("OR" in tree) return Math.min(...tree.OR.map((t) => treeCost(t, ctx, memo, visiting)));
  return 0; // NOT: a restriction, not something to schedule
}

// Cost of adding `id` to the plan: the course itself plus whatever its prerequisites drag in.
// minGrade on an exam leaf is a score ("4"); a non-numeric one just means "took it".
function passed(examName: string, minGrade: string | undefined, ctx: PrereqContext): boolean {
  const score = ctx.exams.get(examName.toUpperCase());
  if (score === undefined) return false;
  const needed = Number(minGrade);
  return Number.isFinite(needed) ? score >= needed : true;
}

// A course whose prerequisites the student can't currently meet (e.g. ICS H32 needs an AP Computer
// Science score they haven't entered) is still plannable, but should almost never win over an
// option they can actually take.
const UNREACHABLE = 50;
// Honors courses usually need honors-program admission, so prefer the regular version.
const HONORS = 10;

export function courseCost(id: string, ctx: PrereqContext, memo = new Map<string, number>(), visiting = new Set<string>()): number {
  if (ctx.have.has(id)) return 0;
  const course = ctx.catalog.get(id);
  if (!course || visiting.has(id)) return Infinity; // unknown/retired course, or a prerequisite cycle
  const cached = memo.get(id);
  if (cached !== undefined) return cached;
  visiting.add(id);
  const inner = treeCost(course.prerequisiteTree, ctx, memo, visiting);
  visiting.delete(id);
  const cost = 1 + (Number.isFinite(inner) ? inner : UNREACHABLE) + (course.honors ? HONORS : 0);
  memo.set(id, cost);
  return cost;
}

export type Requisite = { id: string; coreq: boolean };

// The direct requisites to plan for `tree`: every branch of an AND, and the cheapest branch of
// an OR (an option the student already has costs 0, so it always wins).
export function resolveTree(tree: PrereqTree | null, ctx: PrereqContext): Requisite[] {
  if (!tree) return [];
  if (isLeaf(tree)) {
    if (tree.prereqType === "exam") return [];
    const id = normalizeCourseId(tree.courseId);
    return Number.isFinite(courseCost(id, ctx)) ? [{ id, coreq: tree.coreq }] : [];
  }
  if ("AND" in tree) return tree.AND.flatMap((t) => resolveTree(t, ctx));
  if ("OR" in tree) {
    const memo = new Map<string, number>();
    let best: PrereqTree | null = null;
    let bestCost = Infinity;
    for (const option of tree.OR) {
      const cost = treeCost(option, ctx, memo);
      if (cost < bestCost) [best, bestCost] = [option, cost];
    }
    // still recurse when the best option costs 0: a course already in the plan must be ordered before this one
    return best ? resolveTree(best, ctx) : [];
  }
  return [];
}
