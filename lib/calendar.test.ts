import { describe, expect, it } from "vitest";
import { chooseSections, clock, conflicts, layoutLanes, parseDays, toBlocks, type Section } from "./calendar";

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
});
