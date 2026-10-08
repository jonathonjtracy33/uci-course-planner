import { describe, expect, it } from "vitest";
import { PLAN_ID, validPlan } from "./saved-plan-rules";

describe("saved plan rules", () => {
  it("accepts a normal plan", () => {
    expect(validPlan({ path: "/plan/BS-19H", search: "?taken=I%26CSCI31" })).toEqual({ path: "/plan/BS-19H", search: "?taken=I%26CSCI31" });
    expect(validPlan({ path: "/plan/undeclared", search: "" })).not.toBeNull();
  });

  it("rejects anything else", () => {
    expect(validPlan({ path: "https://evil.example", search: "" })).toBeNull();
    expect(validPlan({ path: "/plan/BS-19H", search: "x".repeat(5000) })).toBeNull();
    expect(validPlan({ path: "/plan/BS-19H", search: "no-question-mark" })).toBeNull();
    expect(validPlan(null)).toBeNull();
    expect(PLAN_ID.test("short")).toBe(false);
    expect(PLAN_ID.test("a".repeat(22))).toBe(true);
  });
});
