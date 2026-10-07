import { describe, expect, it } from "vitest";
import type { PrereqTree } from "@/db/schema";
import { geProgress } from "./ge";
import { recommendGes, type GeCandidate } from "./ge-recommend";

const ge = (id: string, cats: string[], opts: Partial<GeCandidate> = {}): GeCandidate =>
  ({ id, code: id, title: id, units: 4, ge: cats, seasons: "FWS", number: 10, prerequisiteTree: null, prerequisiteText: null, restriction: null, overlaps: [], ...opts });
const needs = (id: string): PrereqTree => ({ prereqType: "course", courseId: id, coreq: false });

const base = {
  progress: geProgress([]),
  season: "Fall" as const,
  student: { have: new Set<string>(), exams: new Map<string, number>() },
  standing: { year: 1, majorName: "Major in Anthropology" },
  exclude: new Set<string>(),
  openUnits: 12,
};

describe("GE recommendations", () => {
  it("prefers a course that fills several open categories", () => {
    const recs = recommendGes({ ...base, candidates: [ge("ONE", ["GE-2"]), ge("THREE", ["GE-2", "GE-5A", "GE-8"])] });
    expect(recs[0].course.id).toBe("THREE");
    expect(recs[0].fills).toEqual(["GE-2", "GE-8", "GE-5A"]);
  });

  it("ranks courses whose prerequisites are met above ones that aren't", () => {
    const recs = recommendGes({ ...base, candidates: [ge("HARD", ["GE-4"], { prerequisiteTree: needs("X 1") }), ge("EASY", ["GE-4"])] });
    expect(recs.map((r) => r.course.id)).toEqual(["EASY", "HARD"]);
    expect(recs[1].missing).toEqual([{ kind: "course", id: "X1", code: "X 1" }]);
  });

  it("counts prerequisites the student has already completed", () => {
    const recs = recommendGes({ ...base, student: { ...base.student, have: new Set(["X1"]) }, candidates: [ge("NEXT", ["GE-4"], { prerequisiteTree: needs("X 1") })] });
    expect(recs[0].reasons).toContain("You've met the prerequisites");
  });

  it("skips categories that are already covered and courses the student can't enroll in", () => {
    const progress = geProgress([{ id: "W", ge: ["GE-1B"], status: "done" }]);
    const recs = recommendGes({
      ...base,
      progress,
      candidates: [ge("UDW", ["GE-1B"]), ge("HONORS", ["GE-3"], { restriction: "Campuswide Honors Collegium only" }), ge("OK", ["GE-3"])],
    });
    expect(recs.map((r) => r.course.id)).toEqual(["OK"]);
  });

  it("spreads picks across categories instead of stacking one", () => {
    const recs = recommendGes({ ...base, candidates: [ge("A", ["GE-8"]), ge("B", ["GE-8"]), ge("C", ["GE-7"])] });
    expect(recs.map((r) => r.course.id).sort()).toEqual(["A", "C"]);
  });

  it("puts lower-division writing ahead of other single-category courses (it has a deadline)", () => {
    const recs = recommendGes({ ...base, candidates: [ge("ART", ["GE-4"]), ge("WRITING60", ["GE-1A"])] });
    expect(recs[0].course.id).toBe("WRITING60");
  });

  it("treats prerequisite text without structured data as a requirement", () => {
    const recs = recommendGes({ ...base, candidates: [ge("HUMAN1BES", ["GE-1A"], { prerequisiteText: "HUMAN 1AES" }), ge("WRITING60", ["GE-1A"])] });
    expect(recs[0].course.id).toBe("WRITING60");
    expect(recs.find((r) => r.course.id === "HUMAN1BES")?.missing).toEqual([{ kind: "course", id: "HUMAN1AES", code: "HUMAN 1AES" }]);
  });

  it("skips a GE alternative to a course already taken, and courses that overlap one", () => {
    const recs = recommendGes({
      ...base,
      student: { ...base.student, have: new Set(["WRITING50", "WRITING45X"]) },
      candidates: [ge("WRITING39B", ["GE-1A"]), ge("WRITING60", ["GE-1A"]), ge("OVERLAP", ["GE-4"], { overlaps: ["WRITING45X"] })],
    });
    expect(recs.map((r) => r.course.id)).toEqual(["WRITING60"]);
  });

  it("only suggests courses offered that season", () => {
    expect(recommendGes({ ...base, candidates: [ge("SPRING", ["GE-2"], { seasons: "S" })] })).toEqual([]);
  });
});
