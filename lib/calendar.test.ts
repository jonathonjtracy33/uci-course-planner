import { describe, expect, it } from "vitest";
import { chooseProfessor, chooseSections, clock, conflicts, finalsSchedule, layoutLanes, parseDays, professorsOf, sectionsFor, toBlocks, type Section } from "./calendar";

const sec = (code: string, type: string, status: string, days = "MWF", start = 600, end = 650): Section =>
  ({ code, type, instructors: [], status, seatsLeft: status === "FULL" ? 0 : 5, meetings: [{ days: parseDays(days), start, end, place: "" }] });

describe("calendar", () => {
  it("reads UCI's day codes", () => {
    expect(parseDays("MWF")).toEqual([0, 2, 4]);
    expect(parseDays("TuTh")).toEqual([1, 3]);
    expect(parseDays("MTuWThF")).toEqual([0, 1, 2, 3, 4]);
    expect(parseDays("TBA")).toEqual([]);
  });

  it("formats times", () => {
    expect(clock(11 * 60)).toBe("11:00am");
    expect(clock(12 * 60 + 20)).toBe("12:20pm");
    expect(clock(13 * 60 + 5)).toBe("1:05pm");
  });

  it("picks one section of each type, preferring the student's choice, then open seats", () => {
    const sections = [sec("1", "Lec", "FULL"), sec("2", "Lec", "OPEN"), sec("3", "Dis", "OPEN"), sec("4", "Dis", "OPEN")];
    expect(chooseSections(sections, new Set()).map((s) => s.code)).toEqual(["2", "3"]);
    expect(chooseSections(sections, new Set(["1", "4"])).map((s) => s.code)).toEqual(["1", "4"]);
  });

  it("finds overlapping classes on the same day", () => {
    const a = toBlocks("A", "A", [sec("10", "Lec", "OPEN", "MWF", 600, 650)]);
    const b = toBlocks("B", "B", [sec("20", "Lec", "OPEN", "TuTh", 600, 680)]);
    const c = toBlocks("C", "C", [sec("30", "Lec", "OPEN", "MW", 630, 700)]);
    expect(conflicts([...a, ...b])).toEqual([]);
    expect(conflicts([...a, ...c]).map(([x, y]) => [x.day, x.courseId, y.courseId])).toEqual([[0, "A", "C"], [2, "A", "C"]]);
  });

  it("puts overlapping classes side by side", () => {
    const laid = layoutLanes([{ id: "a", start: 540, end: 590 }, { id: "b", start: 540, end: 590 }, { id: "c", start: 660, end: 710 }]);
    const by = Object.fromEntries(laid.map((b) => [b.id, [b.lane, b.lanes]]));
    expect(by).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });

  it("orders finals by date and flags ones at the same time", () => {
    const withFinal = (code: string, day: number, start: number): Section => ({ ...sec(code, "Lec", "OPEN"), final: { month: 2, day, weekday: "", start, end: start + 120, place: "" } });
    const { dated, undated, clashes } = finalsSchedule([
      { courseId: "B", label: "B", sections: [withFinal("2", 15, 600)] },
      { courseId: "A", label: "A", sections: [withFinal("1", 13, 480)] },
      { courseId: "C", label: "C", sections: [withFinal("3", 15, 660)] },
      { courseId: "D", label: "D", sections: [sec("4", "Lec", "OPEN")] },
    ]);
    expect(dated.map((r) => r.label)).toEqual(["A", "B", "C"]);
    expect(undated.map((r) => r.label)).toEqual(["D"]);
    expect(clashes.map(([x, y]) => [x.label, y.label])).toEqual([["B", "C"]]);
  });

  it("lists professors and narrows sections to the one chosen", () => {
    const by = (code: string, type: string, who: string, status = "OPEN"): Section => ({ ...sec(code, type, status), instructors: [who] });
    const sections = [by("1", "Lec", "SMITH, A.", "FULL"), by("2", "Lec", "LEE, B."), by("3", "Lec", "SMITH, A."), by("4", "Dis", "SMITH, A."), by("5", "Dis", "LEE, B."), by("6", "Lab", "STAFF")];
    expect(professorsOf(sections)).toEqual(["SMITH, A.", "LEE, B."]);
    expect(sectionsFor(sections, "Lec", "SMITH, A.").map((s) => s.code)).toEqual(["1", "3"]);
    expect(sectionsFor(sections, "Lab", "SMITH, A.").map((s) => s.code)).toEqual(["6"]); // no labs of theirs: all labs
    expect(chooseProfessor(sections, "SMITH, A.", new Set(["2", "5", "6"]))).toEqual(["3", "4", "6"]); // most open lecture of theirs
  });

  it("takes professors from the lectures even when a discussion is listed first", () => {
    const by = (code: string, type: string, who: string): Section => ({ ...sec(code, type, "OPEN"), instructors: [who] });
    const sections = [by("1", "Dis", "TA, ONE"), by("2", "Lec", "GILLEN, D."), by("3", "Lec", "ZHU, P."), by("4", "Dis", "TA, TWO")];
    expect(professorsOf(sections)).toEqual(["GILLEN, D.", "ZHU, P."]);
    expect(chooseProfessor(sections, "GILLEN, D.", new Set(["3", "4"]))).toEqual(["4", "2"]); // keeps the chosen discussion
  });
});
