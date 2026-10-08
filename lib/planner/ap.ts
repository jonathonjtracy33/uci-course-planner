// UCI's AP credit rules: each exam grants courses depending on the score.
import { normalizeCourseId } from "./prereqs";

export type CourseGrant = string | { AND: CourseGrant[] } | { OR: CourseGrant[] };
export type ApExam = {
  name: string; // "AP Calculus BC"
  catalogueName: string | null; // how prerequisite trees refer to it: "AP CALCULUS BC"
  rewards: {
    scores: number[];
    courses: CourseGrant;
    units: number; // total units of credit, whether or not specific courses are granted
    ge: Record<string, number>; // GE courses credited per category, e.g. { "GE-6": 1 }
  }[];
};

const grantedIds = (g: CourseGrant): string[] =>
  typeof g === "string" ? [normalizeCourseId(g)] : ("AND" in g ? g.AND : g.OR).flatMap(grantedIds);

// The courses a grant actually credits: every course of an AND, but only one option of an OR. Used
// for GE credit, where "HISTORY 40A or 40B or 40C" is one Arts and Humanities course, not three.
const creditedIds = (g: CourseGrant): string[] =>
  typeof g === "string" ? [normalizeCourseId(g)] : "AND" in g ? g.AND.flatMap(creditedIds) : g.OR.length ? creditedIds(g.OR[0]) : [];

// Corrections where the Anteater API disagrees with UCI's official AP credit chart (General
// Catalogue, Undergraduate Admissions). A granted course brings its own GE categories, so "ge" here
// is only the extra credit the chart gives on top of those courses. Checked October 2026.
export const AP_CHART_FIXES: Record<string, { scores: number[]; courses?: CourseGrant; ge?: Record<string, number> }[]> = {
  // "One lower-division course toward the History major ..., GE category IV, and satisfaction of
  // category VIII." The API lists three category IV courses.
  "AP European History": [{ scores: [5], ge: { "GE-4": 1, "GE-8": 1 } }],
  // MGMT 7 is an alternative for a 4 or 5, not a second course (still 4 units).
  "AP Statistics": [{ scores: [4, 5], courses: { OR: ["STATS 7", "STATS 8", "SOCECOL 13", "EDUC 15", "MGMT 7"] } }],
};

export function withChartFixes(exam: ApExam): ApExam {
  const fixes = AP_CHART_FIXES[exam.name];
  if (!fixes) return exam;
  return {
    ...exam,
    rewards: exam.rewards.map((r) => {
      const fix = fixes.find((f) => f.scores.join() === r.scores.join());
      return fix ? { ...r, courses: fix.courses ?? r.courses, ge: fix.ge ?? r.ge } : r;
    }),
  };
}

// Turns { exam name -> score } into courses to treat as completed and exam scores for prerequisites.
// An OR grant ("MATH 2A or MATH 5A") credits one of the options. Marking all of them completed plans
// the same way, because a student never needs more than one of a set of equivalent courses; for GE
// credit only one of them counts (geCourses).
export function applyApCredit(exams: ApExam[], scores: Record<string, number>) {
  const completed: string[] = [];
  const geCourses: string[] = [];
  const examScores: Record<string, number> = {};
  const ge: Record<string, number> = {};
  let units = 0;
  for (const exam of exams.map(withChartFixes)) {
    const score = scores[exam.name];
    if (score === undefined) continue;
    examScores[(exam.catalogueName ?? exam.name).toUpperCase()] = score;
    for (const reward of exam.rewards) {
      if (!reward.scores.includes(score)) continue;
      completed.push(...grantedIds(reward.courses));
      geCourses.push(...creditedIds(reward.courses));
      units += reward.units;
      for (const [category, count] of Object.entries(reward.ge)) ge[category] = (ge[category] ?? 0) + count;
    }
  }
  return { completed, geCourses: [...new Set(geCourses)], exams: examScores, units, ge };
}
