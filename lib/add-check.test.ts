import { describe, expect, it } from "vitest";
import type { PrereqTree } from "@/db/schema";
import { checkAddition } from "./add-check";
import type { GeCandidate } from "./ge-recommend";

const details = (opts: Partial<GeCandidate> = {}): GeCandidate =>
  ({ id: "X1", code: "X 1", title: "X", units: 4, ge: [], seasons: "FWS", number: 10, prerequisiteTree: null, prerequisiteText: null, restriction: null, overlaps: [], ...opts });
const needs = (id: string): PrereqTree => ({ prereqType: "course", courseId: id, coreq: false });
const base = {
  course: { id: "X1", code: "X 1", units: 4 },
  details: details(),
  quarterLabel: "Winter 2027",
  offered: true,
  scheduleKnown: true,
  student: { have: new Set<string>(), exams: new Map<string, number>() },
  standing: { year: 1, majorName: "Major in Informatics" },
  owned: new Set<string>(),
  unitsPlanned: 8,
  maxUnits: 16,
};
const kinds = (input: typeof base) => checkAddition(input).map((i) => i.kind);

describe("checking a course before adding it", () => {
  it("passes a course that works", () => {
    expect(checkAddition(base)).toEqual([]);
  });

  it("flags each kind of problem", () => {
    expect(kinds({ ...base, owned: new Set(["X1"]) })).toEqual(["owned"]);
    expect(kinds({ ...base, offered: false })).toEqual(["not-offered"]);
    expect(kinds({ ...base, details: details({ prerequisiteTree: needs("Y 1") }) })).toEqual(["prereqs"]);
    expect(kinds({ ...base, details: details({ restriction: "Seniors only." }) })).toEqual(["restricted"]);
    expect(kinds({ ...base, unitsPlanned: 14 })).toEqual(["units"]);
    expect(kinds({ ...base, details: details({ overlaps: ["Z1"] }), owned: new Set(["Z1"]) })).toEqual(["owned"]);
  });

  it("says whether 'not offered' comes from the posted schedule or from past offerings", () => {
    expect(checkAddition({ ...base, offered: false })[0].message).toContain("Schedule of Classes");
    expect(checkAddition({ ...base, offered: false, scheduleKnown: false })[0].message).toContain("doesn't usually offer");
  });

  it("counts prerequisites finished in earlier quarters", () => {
    expect(kinds({ ...base, details: details({ prerequisiteTree: needs("Y 1") }), student: { ...base.student, have: new Set(["Y1"]) } })).toEqual([]);
  });
});
