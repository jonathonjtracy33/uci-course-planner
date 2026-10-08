import { describe, expect, it } from "vitest";
import { formatDate, quarterIsOver } from "./term-dates";

const winter = { instructionStart: "2027-01-04", finalsEnd: "2027-03-19", socAvailable: "2026-10-31" };

describe("quarter dates", () => {
  it("formats calendar dates without time-zone shifts", () => {
    expect(formatDate("2026-10-31")).toBe("Oct 31, 2026");
  });

  it("counts a quarter as over the day after finals end", () => {
    expect(quarterIsOver(winter, new Date(2027, 2, 19, 23, 59))).toBe(false);
    expect(quarterIsOver(winter, new Date(2027, 2, 20, 0, 1))).toBe(true);
  });
});
