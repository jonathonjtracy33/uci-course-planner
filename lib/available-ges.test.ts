import { describe, expect, it } from "vitest";
import type { PrereqTree } from "@/db/schema";
import { availableGes, subjectFor } from "./available-ges";
import { geProgress } from "./ge";
import type { GeCandidate } from "./ge-recommend";

const ge = (code: string, cats: string[], opts: Partial<GeCandidate> = {}): GeCandidate =>
  ({ id: code.replace(/\s+/g, ""), code, title: code, units: 4, ge: cats, seasons: "FWS", number: Number(code.match(/\d+/)?.[0] ?? 10), prerequisiteTree: null, prerequisiteText: null, restriction: null, overlaps: [], ...opts });
const live = (term: string, status: string, seatsLeft = 10) => ({ live: { term, status, seatsLeft, sections: 1 } });
const needs = (id: string): PrereqTree => ({ prereqType: "course", courseId: id, coreq: false });

const base = {
  progress: geProgress([]),
  season: "Winter" as const,
  student: { have: new Set<string>(), exams: new Map<string, number>() },
  standing: { year: 1, majorName: "Major in Informatics" },
  owned: new Set<string>(),
  scheduleTerm: null,
  subject: null,
  openUnits: 8,
};
const codes = (r: { results: { course: GeCandidate }[] }) => r.results.map((a) => a.course.code);

describe("available GEs", () => {
  it("sorts departments into subjects", () => {
    expect(subjectFor("HISTORY 21B")).toBe("history");
    expect(subjectFor("BIO SCI 9B")).toBe("science");
    expect(subjectFor("I&C SCI 31")).toBe("computing");
    expect(subjectFor("UNI STU 3")).toBe("other");
  });

  it("only shows classes the student can take: prerequisites done, not restricted, not already had", () => {
    const courses = [
      ge("HISTORY 21A", ["GE-4"]),
      ge("HISTORY 40A", ["GE-4"], { prerequisiteTree: needs("HISTORY 1") }),
      ge("HISTORY 70A", ["GE-4"], { restriction: "History majors only." }),
      ge("HISTORY 21B", ["GE-4"]),
      ge("HISTORY 21C", ["GE-4"], { seasons: "F" }), // not offered in Winter
    ];
    const out = availableGes({ ...base, courses, subject: "history", owned: new Set(["HISTORY21B"]) });
    expect(codes(out)).toEqual(["HISTORY 21A"]);
  });

  it("uses open seats on the posted Schedule of Classes once it's out", () => {
    const courses = [
      ge("MUSIC 14", ["GE-4"], live("Winter 2027", "OPEN")),
      ge("MUSIC 8", ["GE-4"], live("Winter 2027", "FULL")),
      ge("MUSIC 9", ["GE-4"], live("Winter 2027", "Waitl")),
      ge("MUSIC 3", ["GE-4"]), // not on this quarter's schedule
    ];
    expect(codes(availableGes({ ...base, courses, subject: "arts", scheduleTerm: "Winter 2027" }))).toEqual(["MUSIC 14"]);
  });

  it("picks the best fits across subjects when no subject is chosen", () => {
    const courses = [ge("HISTORY 21A", ["GE-4"]), ge("ANTHRO 2A", ["GE-3", "GE-8"]), ge("MATH 2A", ["GE-5B"])];
    const out = availableGes({ ...base, courses, limit: 2 });
    expect(codes(out)).toEqual(["ANTHRO 2A", "HISTORY 21A"]);
    expect(out.results[0].fills).toEqual(["GE-3", "GE-8"]);
  });

  it("flags a subject whose GEs the student has already covered, and puts classes that still help first", () => {
    const progress = geProgress([
      { id: "A", ge: ["GE-4"], status: "done" }, { id: "B", ge: ["GE-4"], status: "done" }, { id: "C", ge: ["GE-4"], status: "done" },
    ]);
    const courses = [ge("HISTORY 21A", ["GE-4"]), ge("HISTORY 15", ["GE-4", "GE-8"])];
    const out = availableGes({ ...base, courses, progress, subject: "history" });
    expect(out.coveredInSubject).toEqual(["GE-4"]);
    expect(codes(out)).toEqual(["HISTORY 15", "HISTORY 21A"]);
    expect(out.results[1]).toMatchObject({ fills: [], alreadyDone: ["GE-4"] });
  });

  it("keeps a Va class useful while Category V's total is unfinished", () => {
    const progress = geProgress([{ id: "STATS7", ge: ["GE-5A"], status: "done" }]);
    const out = availableGes({ ...base, courses: [ge("STATS 8", ["GE-5A"])], progress, subject: "math" });
    expect(out.coveredInSubject).toEqual([]);
    expect(out.results[0].fills).toEqual(["GE-5"]);
  });
});
