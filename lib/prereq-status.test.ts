import { describe, expect, it } from "vitest";
import type { PrereqTree } from "@/db/schema";
import { prereqStatus } from "./prereq-status";
import { checkRestriction } from "./restrictions";

const course = (courseId: string, coreq = false): PrereqTree => ({ prereqType: "course", courseId, coreq });
const state = (have: string[], exams: [string, number][] = [], sameQuarter: string[] = []) =>
  ({ have: new Set(have), exams: new Map(exams), sameQuarter: new Set(sameQuarter) });

describe("prerequisite status", () => {
  it("is met with no prerequisites", () => {
    expect(prereqStatus(null, state([]))).toEqual({ met: true, missing: [] });
  });

  it("lists every missing course of an AND", () => {
    const s = prereqStatus({ AND: [course("WRITING 50"), course("MATH 2A")] }, state(["WRITING50"]));
    expect(s).toEqual({ met: false, missing: [{ kind: "course", id: "MATH2A", code: "MATH 2A" }] });
  });

  it("lists a missing course once even if the tree names it twice", () => {
    const s = prereqStatus({ AND: [course("BIO SCI E109"), { OR: [course("BIO SCI E109"), course("X 1")] }] }, state([]));
    expect(s.missing.map((m) => (m.kind === "course" ? m.id : ""))).toEqual(["BIOSCIE109"]);
  });

  it("is met by any option of an OR, and otherwise reports the closest option", () => {
    const tree: PrereqTree = { OR: [{ AND: [course("A 1"), course("A 2")] }, course("B 1")] };
    expect(prereqStatus(tree, state(["A1", "A2"])).met).toBe(true);
    expect(prereqStatus(tree, state([])).missing).toEqual([{ kind: "course", id: "B1", code: "B 1" }]);
  });

  it("names the other single courses that would satisfy an OR", () => {
    const s = prereqStatus({ OR: [course("WRITING 39B"), course("WRITING 50"), course("WRITING 45")] }, state([]));
    expect(s.missing).toEqual([{ kind: "course", id: "WRITING39B", code: "WRITING 39B", or: [{ id: "WRITING50", code: "WRITING 50" }, { id: "WRITING45", code: "WRITING 45" }] }]);
  });

  it("checks exam scores and allows corequisites in the same quarter", () => {
    const exam: PrereqTree = { prereqType: "exam", examName: "AP Calculus BC", minGrade: "4" };
    expect(prereqStatus(exam, state([], [["AP CALCULUS BC", 3]])).met).toBe(false);
    expect(prereqStatus(exam, state([], [["AP CALCULUS BC", 4]])).met).toBe(true);
    expect(prereqStatus(course("LAB 1", true), state([], [], ["LAB1"])).met).toBe(true);
    expect(prereqStatus(course("LAB 1", false), state([], [], ["LAB1"])).met).toBe(false);
  });
});

describe("enrollment restrictions", () => {
  const anthro = (year: number) => ({ year, majorName: "Major in Anthropology" });

  it("treats first-consideration rules as priority, not a block", () => {
    expect(checkRestriction("Sociology majors have the first consideration for enrollment", anthro(1)).kind).toBe("priority");
  });

  it("checks class standing in that quarter", () => {
    expect(checkRestriction("Freshmen only.", anthro(1)).kind).toBe("ok");
    expect(checkRestriction("Freshmen only.", anthro(2)).kind).toBe("blocked");
    expect(checkRestriction("Upper-division students only.", anthro(2)).kind).toBe("blocked");
    expect(checkRestriction("Upper-division students only.", anthro(3)).kind).toBe("ok");
  });

  it("checks major-only courses against the student's major", () => {
    expect(checkRestriction("Anthropology majors only", anthro(2)).kind).toBe("ok");
    expect(checkRestriction("Campuswide Honors Collegium only", anthro(2)).kind).toBe("blocked");
    expect(checkRestriction("No School of Biological Sciences students", anthro(2)).kind).toBe("ok");
  });
});
