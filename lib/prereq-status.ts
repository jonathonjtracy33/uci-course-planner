// Whether a student has met a course's prerequisites by a given quarter, and if not, what's
// missing. Unlike the planner's cost model (which skips impossible branches so it can still plan),
// this is strict: an unmet placement exam or retired course counts as missing.
import type { PrereqTree } from "@/db/schema";
import { normalizeCourseId } from "./planner/prereqs";

export type Missing =
  | { kind: "course"; id: string; code: string }
  | { kind: "exam"; name: string }
  | { kind: "text"; text: string }; // the catalogue lists a prerequisite the data doesn't structure
export type PrereqStatus = { met: boolean; missing: Missing[] };

export type StudentState = {
  have: Set<string>; // completed, or planned in an earlier quarter
  sameQuarter?: Set<string>; // planned in the same quarter (enough for corequisites)
  exams: Map<string, number>; // upper-cased exam name -> score
};

export function prereqStatus(tree: PrereqTree | null, s: StudentState): PrereqStatus {
  if (!tree) return { met: true, missing: [] };
  if ("prereqType" in tree) {
    if (tree.prereqType === "exam") {
      const score = s.exams.get(tree.examName.toUpperCase());
      const needed = Number(tree.minGrade);
      const met = score !== undefined && (!Number.isFinite(needed) || score >= needed);
      return { met, missing: met ? [] : [{ kind: "exam", name: tree.examName }] };
    }
    const id = normalizeCourseId(tree.courseId);
    const met = s.have.has(id) || (tree.coreq && !!s.sameQuarter?.has(id));
    return { met, missing: met ? [] : [{ kind: "course", id, code: tree.courseId }] };
  }
  if ("AND" in tree) {
    const parts = tree.AND.map((t) => prereqStatus(t, s));
    return { met: parts.every((p) => p.met), missing: dedupe(parts.flatMap((p) => p.missing)) };
  }
  if ("OR" in tree) {
    const parts = tree.OR.map((t) => prereqStatus(t, s));
    if (parts.some((p) => p.met)) return { met: true, missing: [] };
    // Report the option that's closest to done; prefer course paths over exams.
    const best = [...parts].sort((a, b) => a.missing.length - b.missing.length || examCount(a) - examCount(b))[0];
    return { met: false, missing: best?.missing ?? [] };
  }
  return { met: true, missing: [] }; // NOT: a restriction on what you may have taken, not a prerequisite
}

// Some courses have prerequisite text but no structured tree (e.g. "HUMAN 1AES"). Treat the text as
// an unmet requirement rather than pretending there are none.
export function courseStatus(c: { prerequisiteTree: PrereqTree | null; prerequisiteText?: string | null }, s: StudentState): PrereqStatus {
  if (c.prerequisiteTree) return prereqStatus(c.prerequisiteTree, s);
  const text = c.prerequisiteText?.trim();
  if (!text) return { met: true, missing: [] };
  const id = normalizeCourseId(text);
  if (/^[A-Z&/ ]+\d+[A-Z]*$/.test(text)) return s.have.has(id) ? { met: true, missing: [] } : { met: false, missing: [{ kind: "course", id, code: text }] };
  return { met: false, missing: [{ kind: "text", text }] };
}

const keyOf = (m: Missing) => (m.kind === "course" ? m.id : m.kind === "exam" ? m.name : m.text);
const dedupe = (list: Missing[]) => list.filter((m, i) => list.findIndex((x) => keyOf(x) === keyOf(m)) === i);

const examCount = (p: PrereqStatus) => p.missing.filter((m) => m.kind === "exam").length;
