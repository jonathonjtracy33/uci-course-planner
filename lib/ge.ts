// UCI's general education requirement (2026-27 catalogue, "Requirements for a Bachelor's Degree").
// A course can count toward several categories at once, except that one course can't fill both Va
// and Vb. Category V needs one Va course, one Vb course, and a third from either.

export const GE_CATALOGUE_URL = "https://catalogue.uci.edu/informationforadmittedstudents/requirementsforabachelorsdegree/#generaleducationrequirementtexttab";
export const UNITS_TO_GRADUATE = 180; // minimum quarter units for any UCI bachelor's degree

export type GeCategory = { code: string; numeral: string; name: string; need: number; note?: string; usual?: string[] };

export const GE_CATEGORIES: GeCategory[] = [
  // The catalogue's standard path is WRITING 50 (or 39B), then WRITING 60; other Ia courses are alternate tracks.
  { code: "GE-1A", numeral: "Ia", name: "Lower-Division Writing", need: 2, note: "Usually WRITING 50 (or 39B), then WRITING 60, by the end of year 2", usual: ["WRITING50", "WRITING60", "WRITING39B"] },
  { code: "GE-1B", numeral: "Ib", name: "Upper-Division Writing", need: 1 },
  { code: "GE-2", numeral: "II", name: "Science and Technology", need: 3 },
  { code: "GE-3", numeral: "III", name: "Social and Behavioral Sciences", need: 3 },
  { code: "GE-4", numeral: "IV", name: "Arts and Humanities", need: 3 },
  { code: "GE-5A", numeral: "Va", name: "Quantitative Literacy", need: 1 },
  { code: "GE-5B", numeral: "Vb", name: "Formal Reasoning", need: 1 },
  { code: "GE-6", numeral: "VI", name: "Language Other Than English", need: 1, note: "Or three years of one language in high school" },
  { code: "GE-7", numeral: "VII", name: "Multicultural Studies", need: 1 },
  { code: "GE-8", numeral: "VIII", name: "International/Global Issues", need: 1 },
];

export const V_TOTAL = 3;

// Courses UCI's GE requirement treats as alternatives: take one, not both
// ("Writing 50 or 39B" for lower-division writing).
export const GE_ALTERNATIVES: string[][] = [["WRITING50", "WRITING39B"]];

export type GeCourse = { id: string; ge: string[]; status: "done" | "planned" };
export type GeProgress = Record<string, { done: number; planned: number; need: number; courses: string[] }>;

// Counts how many courses fill each category, split into done (taken or AP) and planned.
export function geProgress(courses: GeCourse[], apCredit: Record<string, number> = {}): GeProgress {
  const progress: GeProgress = {};
  for (const c of GE_CATEGORIES) progress[c.code] = { done: apCredit[c.code] ?? 0, planned: 0, need: c.need, courses: [] };
  progress["GE-5"] = { done: (apCredit["GE-5A"] ?? 0) + (apCredit["GE-5B"] ?? 0), planned: 0, need: V_TOTAL, courses: [] };

  const seen = new Set<string>();
  // Done courses first, so a course taken counts as done even if it's also in the plan.
  for (const course of [...courses].sort((a, b) => (a.status === b.status ? 0 : a.status === "done" ? -1 : 1))) {
    if (seen.has(course.id)) continue;
    seen.add(course.id);
    const add = (code: string) => {
      progress[code][course.status === "done" ? "done" : "planned"]++;
      progress[code].courses.push(course.id);
    };
    for (const code of course.ge) if (code !== "GE-5A" && code !== "GE-5B" && progress[code]) add(code);

    const va = course.ge.includes("GE-5A");
    const vb = course.ge.includes("GE-5B");
    if (!va && !vb) continue;
    add("GE-5");
    // A course approved for both Va and Vb fills whichever is still empty.
    const filled = (code: string) => progress[code].done + progress[code].planned >= 1;
    add(va && vb ? (filled("GE-5A") && !filled("GE-5B") ? "GE-5B" : "GE-5A") : va ? "GE-5A" : "GE-5B");
  }
  return progress;
}
