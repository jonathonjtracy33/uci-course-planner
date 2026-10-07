import { describe, expect, it } from "vitest";
import type { PrereqTree } from "@/db/schema";
import { exploreCourses, type ExploreFilters } from "./explore";
import { geProgress } from "./ge";
import type { GeCandidate } from "./ge-recommend";

const c = (id: string, opts: Partial<GeCandidate> = {}): GeCandidate =>
  ({ id, code: id, title: id, units: 4, ge: [], seasons: "FWS", number: 10, prerequisiteTree: null, prerequisiteText: null, restriction: null, overlaps: [], ...opts });
const needs = (id: string): PrereqTree => ({ prereqType: "course", courseId: id, coreq: false });
const filters: ExploreFilters = { kind: "all", geCategory: null, readyOnly: true, lowerDivisionOnly: false, noPriority: false, query: "" };
const base = {
  season: "Fall" as const,
  student: { have: new Set<string>(), exams: new Map<string, number>() },
  standing: { year: 1, majorName: "Undeclared" },
  owned: new Set<string>(),
  progress: geProgress([]),
  filters,
};
const ids = (r: { course: GeCandidate }[]) => r.map((x) => x.course.id);

describe("Course Explorer", () => {
  it("shows only courses a student can take now when 'Ready for me' is on", () => {
    const courses = [c("OPEN"), c("NEEDS", { prerequisiteTree: needs("X 1") }), c("HONORS", { restriction: "Campuswide Honors Collegium only" }), c("SPRING", { seasons: "S" })];
    expect(ids(exploreCourses({ ...base, courses }))).toEqual(["OPEN"]);
    const all = exploreCourses({ ...base, courses, filters: { ...filters, readyOnly: false } });
    expect(ids(all)).toEqual(["OPEN", "HONORS", "NEEDS"]); // still not the Spring-only course in Fall
    expect(all.find((r) => r.course.id === "NEEDS")?.missing).toEqual([{ kind: "course", id: "X1", code: "X 1" }]);
  });

  it("counts prerequisites the student will have finished", () => {
    const courses = [c("NEXT", { prerequisiteTree: needs("X 1") })];
    expect(ids(exploreCourses({ ...base, courses, student: { ...base.student, have: new Set(["X1"]) } }))).toEqual(["NEXT"]);
  });

  it("filters GEs, electives, a GE category, and lower division", () => {
    const courses = [c("GE2", { ge: ["GE-2"] }), c("GE4", { ge: ["GE-4"] }), c("ELECTIVE"), c("UPPER", { number: 120 })];
    expect(ids(exploreCourses({ ...base, courses, filters: { ...filters, kind: "ge" } }))).toEqual(["GE2", "GE4"]);
    expect(ids(exploreCourses({ ...base, courses, filters: { ...filters, kind: "elective" } }))).toEqual(["ELECTIVE", "UPPER"]);
    expect(ids(exploreCourses({ ...base, courses, filters: { ...filters, geCategory: "GE-4" } }))).toEqual(["GE4"]);
    expect(ids(exploreCourses({ ...base, courses, filters: { ...filters, lowerDivisionOnly: true } }))).not.toContain("UPPER");
  });

  it("puts courses that fill GE categories still needed first", () => {
    const progress = geProgress([{ id: "DONE", ge: ["GE-7"], status: "done" }]);
    const courses = [c("AAA"), c("MULTI", { ge: ["GE-7"] }), c("SCI", { ge: ["GE-2", "GE-8"] })];
    expect(ids(exploreCourses({ ...base, progress, courses }))).toEqual(["SCI", "AAA", "MULTI"]);
  });

  it("ranks codes that start with the search first", () => {
    const courses = [c("MATH192", { code: "MATH 192", title: "Teaching math" }), c("MATH2D", { code: "MATH 2D", title: "Calculus" })];
    expect(ids(exploreCourses({ ...base, courses, filters: { ...filters, query: "math 2" } }))).toEqual(["MATH2D", "MATH192"]);
  });

  it("uses the posted Schedule of Classes over past offerings once it exists", () => {
    const live = { term: "2026 Fall", status: "OPEN", seatsLeft: 30, sections: 2 };
    const courses = [c("ON", { live }), c("NOTON"), c("NEWLY", { seasons: "S", live })];
    expect(ids(exploreCourses({ ...base, courses, scheduleTerm: "2026 Fall" })).sort()).toEqual(["NEWLY", "ON"]);
    expect(ids(exploreCourses({ ...base, courses, scheduleTerm: null })).sort()).toEqual(["NOTON", "ON"]);
  });

  it("lists open classes before full ones on a posted schedule", () => {
    const at = (status: string) => ({ term: "2026 Fall", status, seatsLeft: status === "FULL" ? 0 : 5, sections: 1 });
    const courses = [c("AFULL", { live: at("FULL") }), c("BOPEN", { live: at("OPEN") }), c("CWAIT", { live: at("Waitl") })];
    expect(ids(exploreCourses({ ...base, courses, scheduleTerm: "2026 Fall" }))).toEqual(["BOPEN", "CWAIT", "AFULL"]);
  });

  it("hides courses already taken or planned, and ones that overlap them", () => {
    const courses = [c("TAKEN"), c("OVERLAPS", { overlaps: ["TAKEN"] }), c("FRESH")];
    expect(ids(exploreCourses({ ...base, owned: new Set(["TAKEN"]), courses }))).toEqual(["FRESH"]);
  });
});
