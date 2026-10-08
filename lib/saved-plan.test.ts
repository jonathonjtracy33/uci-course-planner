import { beforeEach, describe, expect, it } from "vitest";
import { loadPlan, savePlan } from "./saved-plan";

// A stand-in for the browser's localStorage.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as Storage;
});

describe("saved plan", () => {
  it("remembers the last plan and forgets it on reset", () => {
    savePlan("/plan/BS-19H", "?taken=I%26CSCI31");
    expect(loadPlan()).toMatchObject({ path: "/plan/BS-19H", search: "?taken=I%26CSCI31" });
    savePlan("/plan/BS-19H", "");
    expect(loadPlan()).toBeNull();
  });

  it("ignores junk and survives storage being unavailable", () => {
    store.set("degreepath:plan", "{not json");
    expect(loadPlan()).toBeNull();
    globalThis.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } as unknown as Storage;
    expect(loadPlan()).toBeNull();
    expect(() => savePlan("/plan/BS-19H", "?x=1")).not.toThrow();
  });
});
