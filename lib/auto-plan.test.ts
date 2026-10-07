import { describe, expect, it } from "vitest";
import type { PrereqTree } from "@/db/schema";
import { fillElectives, planGes, type QuarterSlot } from "./auto-plan";
import type { GeCandidate } from "./ge-recommend";

const ge = (id: string, cats: string[], opts: Partial<GeCandidate> = {}): GeCandidate =>
  ({ id, code: id, title: id, units: 4, ge: cats, seasons: "FWS", number: 10, prerequisiteTree: null, prerequisiteText: null, restriction: null, overlaps: [], ...opts });
const needs = (id: string): PrereqTree => ({ prereqType: "course", courseId: id, coreq: false });
const quarters = (n: number, units = 0): QuarterSlot[] =>
  Array.from({ length: n }, (_, i) => ({ index: i, season: (["Fall", "Winter", "Spring"] as const)[i % 3], units, courseIds: [] }));
const base = { known: [], apGe: {}, have: new Set<string>(), exams: new Map<string, number>(), majorName: "Undeclared", fullLoad: 16 };

describe("planning GEs automatically", () => {
  it("covers every open category once, spread over quarters", () => {
    const candidates = [ge("SCI1", ["GE-2"]), ge("SCI2", ["GE-2"]), ge("SCI3", ["GE-2"]), ge("MULTI", ["GE-7"])];
    const added = planGes({ ...base, quarters: quarters(4), candidates, perQuarter: 2 });
    expect(added.map((a) => a.id).sort()).toEqual(["MULTI", "SCI1", "SCI2", "SCI3"]);
    expect(Math.max(...[0, 1, 2, 3].map((q) => added.filter((a) => a.quarter === q).length))).toBeLessThanOrEqual(2);
  });

  it("orders a sequence so each course comes after its prerequisite", () => {
    const candidates = [ge("WRITING50", ["GE-1A"]), ge("WRITING60", ["GE-1A"], { prerequisiteTree: needs("WRITING 50") })];
    const added = planGes({ ...base, quarters: quarters(3), candidates, perQuarter: 3 });
    const q = (id: string) => added.find((a) => a.id === id)?.quarter;
    expect(q("WRITING50")).toBeDefined();
    expect(q("WRITING60")!).toBeGreaterThan(q("WRITING50")!);
  });

  it("keeps upper-division courses out of year 1", () => {
    const added = planGes({ ...base, quarters: quarters(4), candidates: [ge("UDW", ["GE-1B"], { number: 195 })], perQuarter: 2 });
    expect(added).toEqual([{ id: "UDW", quarter: 3 }]);
  });

  it("leaves full quarters alone", () => {
    const added = planGes({ ...base, quarters: quarters(1, 16), candidates: [ge("A", ["GE-2"])], perQuarter: 2 });
    expect(added).toEqual([]);
  });

  it("doesn't add courses for categories already covered", () => {
    const added = planGes({ ...base, known: [{ id: "DONE", ge: ["GE-7"], status: "done" }], quarters: quarters(2), candidates: [ge("MULTI", ["GE-7"])], perQuarter: 2 });
    expect(added).toEqual([]);
  });
});

describe("filling electives", () => {
  it("adds 4-unit slots to the lightest quarters until the gap is covered", () => {
    const slots = fillElectives([{ index: 0, units: 16 }, { index: 1, units: 8 }, { index: 2, units: 12 }], 12);
    expect(Object.fromEntries(slots)).toEqual({ 1: 2, 2: 1 });
  });

  it("goes past a normal load only when it has to, and stops at the hard cap", () => {
    expect(Object.fromEntries(fillElectives([{ index: 0, units: 16 }], 8))).toEqual({ 0: 1 }); // 16 -> 20, then full
  });

  it("does nothing when there's no gap", () => {
    expect(fillElectives([{ index: 0, units: 4 }], 0).size).toBe(0);
  });
});
