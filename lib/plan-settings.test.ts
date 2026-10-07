import { describe, expect, it } from "vitest";
import { parseSettings, serializeSettings } from "./plan-settings";

describe("share links", () => {
  it("round-trips every setting through the URL", () => {
    const settings = { entryYear: 2025, firstQuarter: 3, maxUnits: 18, taken: ["I&CSCI31", "WRITING50"], ap: { "AP Physics C: Mechanics": 5 }, ge: [{ id: "ANTHRO2A", quarter: 4 }] };
    expect(parseSettings(serializeSettings(settings, 2026), 2026)).toEqual(settings);
  });

  it("leaves defaults out of the URL and ignores junk", () => {
    expect(serializeSettings(parseSettings("", 2026), 2026)).toBe("");
    expect(parseSettings("?units=99&from=-1&ap=AP+Biology:9&ge=X@abc", 2026)).toMatchObject({ maxUnits: 16, firstQuarter: 0, ap: {}, ge: [] });
  });
});
