import { describe, expect, it } from "vitest";
import { fromStanding, parseSettings, serializeSettings } from "./plan-settings";

describe("share links", () => {
  it("round-trips every setting through the URL", () => {
    const settings = { entryYear: 2025, firstQuarter: 3, maxUnits: 18, taken: ["I&CSCI31", "WRITING50"], ap: { "AP Physics C: Mechanics": 5 }, added: [{ id: "ANTHRO2A", quarter: 4 }], fill: true, setup: 6, unitsDone: 52, grad: 10, summer: true, sections: ["35010", "35020"] };
    expect(parseSettings(serializeSettings(settings, 2026), 2026)).toEqual(settings);
  });

  it("leaves defaults out of the URL and ignores junk", () => {
    expect(serializeSettings(parseSettings("", 2026), 2026)).toBe("");
    expect(parseSettings("?units=99&from=-1&ap=AP+Biology:9&ge=X@abc", 2026)).toMatchObject({ maxUnits: 16, firstQuarter: 0, ap: {}, added: [] });
  });

  it("turns year in college and starting term into plan settings", () => {
    expect(fromStanding(1, 2026, "Fall")).toEqual({ entryYear: 2026, firstQuarter: 0 });
    expect(fromStanding(2, 2026, "Winter")).toEqual({ entryYear: 2025, firstQuarter: 4 });
    expect(fromStanding(3, 2027, "Fall")).toEqual({ entryYear: 2025, firstQuarter: 6 });
  });

  it("still reads links made before \"ge\" was renamed to \"add\"", () => {
    expect(parseSettings("?ge=WRITING50@0", 2026).added).toEqual([{ id: "WRITING50", quarter: 0 }]);
  });
});
