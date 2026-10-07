import { describe, expect, it } from "vitest";
import type { PrereqTree, Requirement } from "@/db/schema";
import { buildPlan, type Catalog, type CatalogCourse, type Plan } from "./index";
import { courseCost, resolveTree, treeCost } from "./prereqs";
import { applyApCredit, type ApExam } from "./ap";
import { offeredSeasons } from "./schedule";

// ---- tiny catalog builders -------------------------------------------------

const ALL_SEASONS = ["2025 Fall", "2025 Winter", "2025 Spring"];

function course(id: string, opts: Partial<CatalogCourse> = {}): CatalogCourse {
  return { id, title: id, minUnits: 4, maxUnits: 4, prerequisiteTree: null, terms: ALL_SEASONS, ...opts };
}
const req = (courseId: string, coreq = false): PrereqTree => ({ prereqType: "course", courseId, coreq });
const exam = (examName: string, minGrade?: string): PrereqTree => ({ prereqType: "exam", examName, minGrade });
const and = (...t: PrereqTree[]): PrereqTree => ({ AND: t });
const or = (...t: PrereqTree[]): PrereqTree => ({ OR: t });
const take = (label: string, courses: string[], courseCount = courses.length): Requirement =>
  ({ label, requirementType: "Course", courseCount, courses });
const catalogOf = (...courses: CatalogCourse[]): Catalog => new Map(courses.map((c) => [c.id, c]));

const where = (plan: Plan, id: string) => plan.quarters.findIndex((q) => q.items.some((i) => i.id === id));
const planned = (plan: Plan) => plan.quarters.flatMap((q) => q.items.map((i) => i.id)).sort();
const opts = { startYear: 2026, balance: false };

// ---- prerequisite trees ----------------------------------------------------

describe("prerequisite trees", () => {
  const catalog = catalogOf(
    course("A"),
    course("B", { prerequisiteTree: req("A") }),
    course("C", { prerequisiteTree: req("B") }),
  );
  const ctx = { catalog, have: new Set<string>(), exams: new Map<string, number>() };

  it("counts a course plus everything it drags in", () => {
    expect(courseCost("A", ctx)).toBe(1);
    expect(courseCost("C", ctx)).toBe(3);
  });

  it("takes the cheapest branch of an OR", () => {
    expect(treeCost(or(req("C"), req("A")), ctx)).toBe(1);
    expect(resolveTree(or(req("C"), req("A")), ctx)).toEqual([{ id: "A", coreq: false }]);
  });

  it("treats an owned course or passed exam as free", () => {
    const owned = { ...ctx, have: new Set(["C"]) };
    expect(resolveTree(or(req("A"), req("C")), owned)).toEqual([{ id: "C", coreq: false }]);
    const passed = { ...ctx, exams: new Map([["AP CALCULUS BC", 5]]) };
    expect(resolveTree(or(req("C"), exam("AP Calculus BC")), passed)).toEqual([]);
  });

  it("requires the minimum exam score", () => {
    const scored3 = { ...ctx, exams: new Map([["AP CALCULUS BC", 3]]) };
    expect(resolveTree(or(req("A"), exam("AP Calculus BC", "4")), scored3)).toEqual([{ id: "A", coreq: false }]);
    const scored4 = { ...ctx, exams: new Map([["AP CALCULUS BC", 4]]) };
    expect(resolveTree(or(req("A"), exam("AP Calculus BC", "4")), scored4)).toEqual([]);
  });

  it("skips impossible branches of an AND instead of failing the course", () => {
    expect(resolveTree(and(req("A"), req("RETIRED101")), ctx)).toEqual([{ id: "A", coreq: false }]);
  });

  it("survives prerequisite cycles", () => {
    const cyclic = catalogOf(course("X", { prerequisiteTree: req("Y") }), course("Y", { prerequisiteTree: req("X") }));
    expect(courseCost("X", { ...ctx, catalog: cyclic })).toBe(2);
  });
});

// ---- requirement selection -------------------------------------------------

describe("selecting courses", () => {
  it("prefers the option with fewer prerequisites", () => {
    const catalog = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }), course("STATS7"), course("STATS67", { prerequisiteTree: req("B") }));
    const plan = buildPlan([take("Stats", ["STATS67", "STATS7"], 1)], catalog, opts);
    expect(planned(plan)).toEqual(["STATS7"]);
  });

  it("reuses a course already in the plan to satisfy an OR prerequisite", () => {
    const catalog = catalogOf(course("MATH2A"), course("ICS6N"), course("ML", { prerequisiteTree: or(req("ICS6N"), req("MATH2A")) }));
    const plan = buildPlan([take("Calc", ["MATH2A"]), take("ML", ["ML"])], catalog, opts);
    expect(planned(plan)).toEqual(["MATH2A", "ML"]);
  });

  it("picks the cheapest sub-requirements of a group", () => {
    const catalog = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }), course("C"));
    const group: Requirement = { label: "Pick 1", requirementType: "Group", requirementCount: 1, requirements: [take("Long", ["B"]), take("Short", ["C"])] };
    expect(planned(buildPlan([group], catalog, opts))).toEqual(["C"]);
  });

  it("fills a unit requirement and adds placeholders for open electives", () => {
    const catalog = catalogOf(course("A"), course("B"), course("C"));
    const units: Requirement = { label: "8 units", requirementType: "Unit", unitCount: 8, courses: ["A", "B", "C"] };
    const open: Requirement = { label: "Electives", requirementType: "Unit", unitCount: 8, courses: [] };
    const plan = buildPlan([units, open], catalog, opts);
    expect(planned(plan)).toEqual(["A", "B", "placeholder:0", "placeholder:1"]);
  });

  it("schedules repeats of a repeatable course in later quarters", () => {
    const plan = buildPlan([take("Studio, 3 times", ["DRAMA145"], 3)], catalogOf(course("DRAMA145")), opts);
    expect(planned(plan)).toEqual(["DRAMA145", "DRAMA145#2", "DRAMA145#3"]);
    expect(where(plan, "DRAMA145#2")).toBeGreaterThan(where(plan, "DRAMA145"));
    expect(where(plan, "DRAMA145#3")).toBeGreaterThan(where(plan, "DRAMA145#2"));
  });

  it("leaves out courses the student already completed", () => {
    const catalog = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }));
    const plan = buildPlan([take("B", ["B"])], catalog, { ...opts, completed: ["A"] });
    expect(planned(plan)).toEqual(["B"]);
    expect(where(plan, "B")).toBe(0);
  });
});

// ---- scheduling ------------------------------------------------------------

describe("scheduling", () => {
  it("never places a course before its prerequisites", () => {
    const catalog = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }), course("C", { prerequisiteTree: and(req("A"), req("B")) }));
    const plan = buildPlan([take("C", ["C"])], catalog, opts);
    expect(where(plan, "A")).toBeLessThan(where(plan, "B"));
    expect(where(plan, "B")).toBeLessThan(where(plan, "C"));
  });

  it("only places a course in a season it's offered", () => {
    const catalog = catalogOf(course("SPRINGONLY", { terms: ["2025 Spring", "2024 Spring"] }));
    const plan = buildPlan([take("x", ["SPRINGONLY"])], catalog, opts);
    expect(plan.quarters[where(plan, "SPRINGONLY")].season).toBe("Spring");
  });

  it("ignores offerings older than the cutoff", () => {
    expect(offeredSeasons(["2015 Fall", "2025 Winter"], 2022)).toEqual(new Set(["Winter"]));
    expect(offeredSeasons(["2015 Fall"], 2022)).toBeNull(); // no recent data: any season
  });

  it("respects the unit cap", () => {
    const catalog = catalogOf(...["A", "B", "C", "D", "E"].map((id) => course(id)));
    const plan = buildPlan([take("all", ["A", "B", "C", "D", "E"])], catalog, { ...opts, maxUnitsPerQuarter: 8 });
    expect(Math.max(...plan.quarters.map((q) => q.units))).toBeLessThanOrEqual(8);
  });

  it("places corequisites that require each other in the same quarter", () => {
    const catalog = catalogOf(
      course("LECTURE", { prerequisiteTree: req("LAB", true) }),
      course("LAB", { prerequisiteTree: req("LECTURE", true) }),
    );
    const plan = buildPlan([take("pair", ["LECTURE", "LAB"])], catalog, opts);
    expect(plan.unscheduled).toEqual([]);
    expect(where(plan, "LECTURE")).toBe(where(plan, "LAB"));
  });

  it("waits until senior year for senior-only courses", () => {
    const catalog = catalogOf(course("CAPSTONE", { restriction: "Seniors only." }));
    const plan = buildPlan([take("cap", ["CAPSTONE"])], catalog, opts);
    expect(where(plan, "CAPSTONE")).toBeGreaterThanOrEqual(9);
  });

  it("puts the head of the longest chain first when the cap forces a choice", () => {
    const catalog = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }), course("C", { prerequisiteTree: req("B") }), course("SOLO"));
    const plan = buildPlan([take("all", ["C", "SOLO"])], catalog, { ...opts, maxUnitsPerQuarter: 4 });
    expect(where(plan, "A")).toBe(0);
  });

  it("balances the load so the plan isn't front-loaded", () => {
    const catalog = catalogOf(...Array.from({ length: 12 }, (_, i) => course(`C${i}`)));
    const plan = buildPlan([take("all", catalog.keys().toArray())], catalog, { startYear: 2026 });
    expect(plan.majorUnitsPerQuarter).toBe(4);
    expect(plan.quarters.every((q) => q.units === 4)).toBe(true);
  });

  it("reports courses that can never be scheduled", () => {
    const catalog = catalogOf(course("X", { prerequisiteTree: req("Y") }), course("Y", { prerequisiteTree: req("X") }));
    const plan = buildPlan([take("both", ["X", "Y"])], catalog, opts);
    expect(plan.unscheduled.map((u) => u.item.id).sort()).toEqual(["X", "Y"]);
    expect(plan.warnings.some((w) => w.includes("couldn't be scheduled"))).toBe(true);
  });
});

// ---- personalization ------------------------------------------------------

describe("starting partway through", () => {
  const catalog = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }), course("CAPSTONE", { restriction: "Seniors only." }));

  it("starts at the given quarter and labels it correctly", () => {
    const plan = buildPlan([take("all", ["B"])], catalog, { ...opts, firstQuarter: 4, completed: ["A"] });
    expect(plan.quarters[0]).toMatchObject({ index: 4, label: "Winter 2028" });
    expect(plan.quarters.at(-1)!.index).toBe(11); // still runs to graduation
  });

  it("times class standing from the student's first Fall, not from the first planned quarter", () => {
    const plan = buildPlan([take("cap", ["CAPSTONE"])], catalog, { ...opts, firstQuarter: 9 });
    expect(plan.quarters.find((q) => q.items.length)!.index).toBe(9);
  });
});

describe("AP credit", () => {
  const exams: ApExam[] = [{
    name: "AP Calculus BC",
    catalogueName: "AP CALCULUS BC",
    rewards: [
      { scores: [4, 5], courses: { OR: [{ AND: ["MATH 2A", "MATH 2B"] }, { AND: ["MATH 5A", "MATH 5B"] }] } },
      { scores: [3], courses: { OR: ["MATH 2A", "MATH 5A"] } },
    ],
  }];

  it("grants courses by score", () => {
    expect(applyApCredit(exams, { "AP Calculus BC": 5 }).completed).toEqual(expect.arrayContaining(["MATH2A", "MATH2B"]));
    expect(applyApCredit(exams, { "AP Calculus BC": 3 }).completed).not.toContain("MATH2B");
    expect(applyApCredit(exams, { "AP Calculus BC": 2 }).completed).toEqual([]);
  });

  it("drops credited courses and their prerequisites from the plan", () => {
    const catalog = catalogOf(course("MATH1B"), course("MATH2A", { prerequisiteTree: req("MATH1B") }), course("MATH2B", { prerequisiteTree: req("MATH2A") }), course("MATH2D", { prerequisiteTree: req("MATH2B") }));
    const credit = applyApCredit(exams, { "AP Calculus BC": 5 });
    const plan = buildPlan([take("calc", ["MATH2A", "MATH2B", "MATH2D"])], catalog, { ...opts, ...credit });
    expect(planned(plan)).toEqual(["MATH2D"]);
  });
});
