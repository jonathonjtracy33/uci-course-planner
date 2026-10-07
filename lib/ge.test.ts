import { describe, expect, it } from "vitest";
import { geProgress } from "./ge";

describe("GE progress", () => {
  it("counts a course toward every category it's approved for", () => {
    const p = geProgress([{ id: "ANTHRO2A", ge: ["GE-3", "GE-8"], status: "planned" }]);
    expect(p["GE-3"]).toMatchObject({ planned: 1, need: 3 });
    expect(p["GE-8"]).toMatchObject({ planned: 1, need: 1 });
  });

  it("separates courses taken from courses planned", () => {
    const p = geProgress([
      { id: "WRITING50", ge: ["GE-1A"], status: "done" },
      { id: "WRITING60", ge: ["GE-1A"], status: "planned" },
    ]);
    expect(p["GE-1A"]).toMatchObject({ done: 1, planned: 1 });
  });

  it("counts a course once even if it's both taken and planned", () => {
    const p = geProgress([{ id: "X", ge: ["GE-2"], status: "planned" }, { id: "X", ge: ["GE-2"], status: "done" }]);
    expect(p["GE-2"]).toMatchObject({ done: 1, planned: 0 });
  });

  it("uses a course approved for Va and Vb for only one of them", () => {
    const p = geProgress([
      { id: "BOTH", ge: ["GE-5A", "GE-5B"], status: "planned" },
      { id: "VA", ge: ["GE-5A"], status: "planned" },
    ]);
    expect(p["GE-5"].planned).toBe(2);
    expect(p["GE-5A"].planned + p["GE-5B"].planned).toBe(2);
  });

  it("fills whichever of Va/Vb is empty with a dual-approved course", () => {
    const p = geProgress([
      { id: "VA", ge: ["GE-5A"], status: "planned" },
      { id: "BOTH", ge: ["GE-5A", "GE-5B"], status: "planned" },
    ]);
    expect(p["GE-5A"].planned).toBe(1);
    expect(p["GE-5B"].planned).toBe(1);
  });

  it("adds AP GE credit", () => {
    const p = geProgress([], { "GE-6": 1, "GE-2": 1 });
    expect(p["GE-6"].done).toBe(1);
    expect(p["GE-2"].done).toBe(1);
  });
});
