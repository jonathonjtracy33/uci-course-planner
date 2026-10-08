import { describe, expect, it } from "vitest";
import type { PrereqTree, Requirement } from "@/db/schema";
import { buildPlan, type Catalog, type CatalogCourse, type Plan } from "./index";
import { termAt, termIndexes } from "./types";
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
    expect(Number.isFinite(courseCost("X", { ...ctx, catalog: cyclic }))).toBe(true);
  });
});

// ---- requirement selection -------------------------------------------------

describe("selecting courses", () => {
  it("prefers the option with fewer prerequisites", () => {
    const catalog = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }), course("STATS7"), course("STATS67", { prerequisiteTree: req("B") }));
    const plan = buildPlan([take("Stats", ["STATS67", "STATS7"], 1)], catalog, opts);
    expect(planned(plan)).toEqual(["STATS7"]);
  });

  it("avoids an option whose prerequisite is an exam the student hasn't passed, unless they have", () => {
    const catalog = catalogOf(
      course("ICS31"), course("ICS32", { prerequisiteTree: req("ICS31") }), course("ICS33", { prerequisiteTree: or(req("ICS32"), req("ICSH32")) }),
      course("ICSH32", { prerequisiteTree: and(exam("AP COMP SCI A", "3")) }), // how the catalog actually writes it
    );
    const group: Requirement = { label: "Intro", requirementType: "Group", requirementCount: 1, requirements: [take("31-33", ["ICS31", "ICS32", "ICS33"]), take("H32-33", ["ICSH32", "ICS33"])] };
    expect(planned(buildPlan([group], catalog, opts))).toEqual(["ICS31", "ICS32", "ICS33"]);
    expect(planned(buildPlan([group], catalog, { ...opts, exams: { "AP COMP SCI A": 5 } }))).toEqual(["ICS33", "ICSH32"]);
  });

  it("prefers the regular course over an honors one", () => {
    const plan = buildPlan([take("Organic chem", ["CHEMH52B", "CHEM51B"], 1)], catalogOf(course("CHEMH52B", { honors: true }), course("CHEM51B")), opts);
    expect(planned(plan)).toEqual(["CHEM51B"]);
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
    const plan = buildPlan([take("Studio, 3 times", ["DRAMA145"], 3)], catalogOf(course("DRAMA145", { maxTimes: 9 })), opts);
    expect(planned(plan)).toEqual(["DRAMA145", "DRAMA145#2", "DRAMA145#3"]);
    expect(where(plan, "DRAMA145#2")).toBeGreaterThan(where(plan, "DRAMA145"));
    expect(where(plan, "DRAMA145#3")).toBeGreaterThan(where(plan, "DRAMA145#2"));
  });

  it("adds up separate requirements for the same repeatable course", () => {
    const lab = catalogOf(course("DRAMA81", { maxTimes: 6 }));
    const plan = buildPlan([take("3 sections", ["DRAMA81"], 3), take("3 more sections", ["DRAMA81"], 3)], lab, opts);
    expect(planned(plan)).toHaveLength(6);
  });

  it("never repeats a course past its limit", () => {
    const plan = buildPlan([take("5 labs", ["LAB", "OTHER"], 5)], catalogOf(course("LAB", { maxTimes: 2 }), course("OTHER")), opts);
    expect(planned(plan)).toEqual(["LAB", "LAB#2", "OTHER"]);
    expect(plan.warnings.some((w) => w.includes("Couldn't find enough"))).toBe(true);
  });

  it("trusts a requirement that names one course several times", () => {
    const plan = buildPlan([take("2 quarters of ARTHIS 198", ["ARTHIS198"], 2)], catalogOf(course("ARTHIS198")), opts);
    expect(planned(plan)).toEqual(["ARTHIS198", "ARTHIS198#2"]);
  });

  it("lets a non-repeatable course count toward two requirements instead of repeating it", () => {
    const plan = buildPlan([take("Intro", ["ICS33"]), take("Core", ["ICS33", "ICS46"], 2)], catalogOf(course("ICS33"), course("ICS46")), opts);
    expect(planned(plan)).toEqual(["ICS33", "ICS46"]);
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
    expect(offeredSeasons(["2015 Fall", "2024 Winter", "2025 Winter"], 2022)).toEqual(new Set(["Winter"]));
    expect(offeredSeasons(["2015 Fall"], 2022)).toBeNull(); // no recent data: any season
  });

  it("doesn't trust a pattern from a single year of offerings", () => {
    expect(offeredSeasons(["2026 Fall"], 2022)).toBeNull(); // a brand-new course
    expect(offeredSeasons(["2025 Fall", "2026 Winter"], 2022)).toBeNull(); // same academic year
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
      { scores: [4, 5], courses: { OR: [{ AND: ["MATH 2A", "MATH 2B"] }, { AND: ["MATH 5A", "MATH 5B"] }] }, units: 8, ge: { "GE-5A": 1 } },
      { scores: [3], courses: { OR: ["MATH 2A", "MATH 5A"] }, units: 4, ge: {} },
    ],
  }];

  it("grants courses by score", () => {
    expect(applyApCredit(exams, { "AP Calculus BC": 5 }).completed).toEqual(expect.arrayContaining(["MATH2A", "MATH2B"]));
    expect(applyApCredit(exams, { "AP Calculus BC": 3 }).completed).not.toContain("MATH2B");
    expect(applyApCredit(exams, { "AP Calculus BC": 2 }).completed).toEqual([]);
  });

  it("totals unit and GE credit", () => {
    expect(applyApCredit(exams, { "AP Calculus BC": 5 })).toMatchObject({ units: 8, ge: { "GE-5A": 1 } });
    expect(applyApCredit(exams, { "AP Calculus BC": 3 })).toMatchObject({ units: 4, ge: {} });
  });

  it("credits only one option of an either/or grant toward GEs", () => {
    expect(applyApCredit(exams, { "AP Calculus BC": 5 }).geCourses).toEqual(["MATH2A", "MATH2B"]);
    expect(applyApCredit(exams, { "AP Calculus BC": 3 }).geCourses).toEqual(["MATH2A"]);
  });

  it("corrects the API with UCI's official AP chart", () => {
    const european: ApExam = { name: "AP European History", catalogueName: null, rewards: [{ scores: [5], courses: { AND: [] }, units: 8, ge: { "GE-4": 3, "GE-8": 1 } }] };
    const stats: ApExam = { name: "AP Statistics", catalogueName: null, rewards: [{ scores: [4, 5], courses: { AND: [{ AND: ["MGMT 7"] }, { OR: ["STATS 7", "STATS 8"] }] }, units: 4, ge: {} }] };
    expect(applyApCredit([european], { "AP European History": 5 }).ge).toEqual({ "GE-4": 1, "GE-8": 1 });
    expect(applyApCredit([stats], { "AP Statistics": 5 }).geCourses).toEqual(["STATS7"]);
    expect(applyApCredit([stats], { "AP Statistics": 5 }).completed).toEqual(expect.arrayContaining(["STATS7", "MGMT7"]));
  });

  it("drops credited courses and their prerequisites from the plan", () => {
    const catalog = catalogOf(course("MATH1B"), course("MATH2A", { prerequisiteTree: req("MATH1B") }), course("MATH2B", { prerequisiteTree: req("MATH2A") }), course("MATH2D", { prerequisiteTree: req("MATH2B") }));
    const credit = applyApCredit(exams, { "AP Calculus BC": 5 });
    const plan = buildPlan([take("calc", ["MATH2A", "MATH2B", "MATH2D"])], catalog, { ...opts, ...credit });
    expect(planned(plan)).toEqual(["MATH2D"]);
  });
});

describe("graduation goals and summers", () => {
  const chain = catalogOf(
    ...["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].map((id, i, all) =>
      course(id, { prerequisiteTree: i ? req(all[i - 1]) : null, terms: [...ALL_SEASONS, "2025 Summer10wk", "2024 Summer1"] })),
  );
  const ten = take("chain", ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);

  it("labels summer terms between Spring and the next Fall", () => {
    expect(termAt(2.5, 2026)).toMatchObject({ season: "Summer", label: "Summer 2027" });
    expect(termIndexes(0, 6, true)).toEqual([0, 1, 2, 2.5, 3, 4, 5, 5.5]);
  });

  it("uses summers to finish a long chain sooner", () => {
    const regular = buildPlan([ten], chain, { ...opts, quarters: 9 });
    const withSummers = buildPlan([ten], chain, { ...opts, quarters: 9, summers: true });
    expect(regular.quarters.at(-1)!.index).toBe(9); // 10 quarters in a row: past the 9-quarter goal
    expect(withSummers.quarters.at(-1)!.index).toBeLessThan(9);
    expect(withSummers.quarters.some((q) => q.season === "Summer")).toBe(true);
  });

  it("only puts courses in summer that UCI offers in summer", () => {
    const noSummer = catalogOf(course("A"), course("B", { prerequisiteTree: req("A") }), course("C", { prerequisiteTree: req("B") }), course("D", { prerequisiteTree: req("C") }));
    const plan = buildPlan([take("abcd", ["A", "B", "C", "D"])], noSummer, { ...opts, summers: true });
    expect(plan.quarters.filter((q) => q.season === "Summer")).toEqual([]);
  });

  it("moves senior-only courses earlier for a student graduating early", () => {
    const catalog = catalogOf(course("CAPSTONE", { restriction: "Seniors only." }));
    expect(buildPlan([take("cap", ["CAPSTONE"])], catalog, opts).quarters.find((q) => q.items.length)!.index).toBe(9);
    expect(buildPlan([take("cap", ["CAPSTONE"])], catalog, { ...opts, quarters: 9 }).quarters.find((q) => q.items.length)!.index).toBe(6);
  });

  it("names the graduation goal when a plan runs past it", () => {
    const plan = buildPlan([ten], chain, { ...opts, quarters: 9 });
    expect(plan.warnings[0]).toContain("past your goal of graduating Spring 2029");
  });

  it("spreads the work out when the student is happy to take longer", () => {
    const catalog = catalogOf(...Array.from({ length: 15 }, (_, i) => course(`C${i}`)));
    const plan = buildPlan([take("all", catalog.keys().toArray())], catalog, { startYear: 2026, quarters: 15 });
    expect(plan.majorUnitsPerQuarter).toBe(4);
    expect(plan.quarters.at(-1)!.index).toBe(14);
  });
});
