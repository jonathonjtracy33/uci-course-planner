import { describe, expect, it } from "vitest";
import { paceTarget, unitsAhead } from "./pace";

describe("graduation pace", () => {
  it("on time is 4 years, with summers only if needed", () => {
    expect(paceTarget("ontime", { grad: 12, firstQuarter: 3, unitsLeft: 120 })).toEqual({ grad: 12, summers: "if-needed" });
  });

  it("early uses the chosen quarter and summers", () => {
    expect(paceTarget("early", { grad: 9, firstQuarter: 0, unitsLeft: 180 })).toEqual({ grad: 9, summers: true });
    expect(paceTarget("early", { grad: 12, firstQuarter: 0, unitsLeft: 180 }).grad).toBe(11); // never later than on time
  });

  it("balanced keeps about 14 units a quarter, even past 4 years", () => {
    expect(paceTarget("balanced", { grad: 12, firstQuarter: 0, unitsLeft: 180 })).toEqual({ grad: 13, summers: false });
    expect(paceTarget("balanced", { grad: 12, firstQuarter: 6, unitsLeft: 40 }).grad).toBe(12); // never sooner than 4 years
  });

  it("measures ahead and behind against 15 units a quarter", () => {
    expect(unitsAhead(60, 3)).toBe(15);
    expect(unitsAhead(30, 3)).toBe(-15);
  });
});
