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

// Turns { exam name -> score } into courses to treat as completed and exam scores for prerequisites.
// An OR grant ("MATH 2A or MATH 5A") credits one of the options. Marking all of them completed plans
// the same way, because a student never needs more than one of a set of equivalent courses.
export function applyApCredit(exams: ApExam[], scores: Record<string, number>) {
  const completed: string[] = [];
  const examScores: Record<string, number> = {};
  const ge: Record<string, number> = {};
  let units = 0;
  for (const exam of exams) {
    const score = scores[exam.name];
    if (score === undefined) continue;
    examScores[(exam.catalogueName ?? exam.name).toUpperCase()] = score;
    for (const reward of exam.rewards) {
      if (!reward.scores.includes(score)) continue;
      completed.push(...grantedIds(reward.courses));
      units += reward.units;
      for (const [category, count] of Object.entries(reward.ge)) ge[category] = (ge[category] ?? 0) + count;
    }
  }
  return { completed, exams: examScores, units, ge };
}
