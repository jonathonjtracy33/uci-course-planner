import { describe, expect, it } from "vitest";
import { planHref, startHref } from "./questionnaire";

describe("questionnaire links", () => {
  it("goes back to /start keeping every plan setting", () => {
    const href = startHref(4, { yr: 2, t: "Winter 2027", major: "BS-19H" }, "?entry=2025&from=4&taken=I%26CSCI31&setup=5");
    const params = new URL(href, "http://x").searchParams;
    expect(params.get("step")).toBe("4");
    expect(params.get("taken")).toBe("I&CSCI31");
    expect(params.get("major")).toBe("BS-19H");
    expect(params.get("setup")).toBeNull(); // that belongs to the plan page
  });

  it("goes forward to the plan, dropping /start's own keys", () => {
    const href = planHref("BS-19H", "?step=4&yr=2&t=Winter+2027&taken=I%26CSCI31", { entry: "2025", from: "4", setup: "5" });
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/plan/BS-19H");
    expect(Object.fromEntries(url.searchParams)).toEqual({ taken: "I&CSCI31", entry: "2025", from: "4", setup: "5" });
  });
});
