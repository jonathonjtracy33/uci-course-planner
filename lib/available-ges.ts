// "Available GEs": classes a student could add to their upcoming quarter that count toward a GE
// category, narrowed to ones they can actually take (offered, open seats once UCI posts the
// Schedule of Classes, prerequisites done, not restricted away from them). Students can browse by
// subject (History, Science, Math, ...); with no subject picked they get the best fits, chosen the
// same way as the GE recommender.
import { GE_CATEGORIES, type GeProgress } from "./ge";
import { fills, openNeeds, recommendGes, redundant, type GeCandidate } from "./ge-recommend";
import { courseStatus, type Missing, type StudentState } from "./prereq-status";
import { checkRestriction, type RestrictionCheck, type Standing } from "./restrictions";
import { SEASON_LETTER, type Season } from "./planner/types";

export const GE_SUBJECTS: { id: string; label: string; departments: string[] }[] = [
  { id: "history", label: "History", departments: ["HISTORY", "CLASSIC"] },
  { id: "science", label: "Science", departments: ["BIO SCI", "CHEM", "PHYSICS", "EARTHSS", "PHY SCI", "PHRMSCI", "BME", "MSE", "ENGR", "ENGRCEE", "NUR SCI"] },
  { id: "math", label: "Math & Stats", departments: ["MATH", "STATS"] },
  { id: "computing", label: "Computing", departments: ["I&C SCI", "IN4MATX", "CSE", "EECS", "GDIM"] },
  { id: "psychology", label: "Psychology", departments: ["PSYCH", "PSY BEH", "PSY", "PSCI", "COGS"] },
  { id: "social", label: "Social Sciences", departments: ["ANTHRO", "SOCIOL", "ECON", "POL SCI", "SOC SCI", "SOCECOL", "CRM/LAW", "INTL ST", "UPPP", "PP&D", "SPPS", "EDUC", "MGMT", "LINGUIS", "LSCI"] },
  { id: "health", label: "Health", departments: ["PUBHLTH", "MED HUM"] },
  { id: "arts", label: "Arts, Film & Music", departments: ["ART", "ART HIS", "ARTS", "DANCE", "DRAMA", "MUSIC", "FLM&MDA"] },
  { id: "literature", label: "Literature & Writing", departments: ["ENGLISH", "WRITING", "LIT JRN", "COM LIT", "HUMAN", "AC ENG"] },
  { id: "languages", label: "Languages", departments: ["ARABIC", "ARMN", "ASL", "CHINESE", "FRENCH", "GERMAN", "GREEK", "HEBREW", "ITALIAN", "JAPANSE", "KOREAN", "LATIN", "PERSIAN", "PORTUG", "RUSSIAN", "SPANISH", "VIETMSE"] },
  { id: "cultures", label: "Cultures & Identity", departments: ["AFAM", "ASIANAM", "CHC/LAT", "GEN&SEX", "WOMN ST", "E ASIAN", "EAS", "EURO ST", "GLBL ME", "GLBLCLT"] },
  { id: "philosophy", label: "Philosophy & Religion", departments: ["PHILOS", "LPS", "REL STD"] },
];

const departmentOf = (code: string) => code.replace(/\s+\S+$/, "");
const subjectOf = new Map(GE_SUBJECTS.flatMap((s) => s.departments.map((d) => [d, s.id] as const)));
export const subjectFor = (code: string) => subjectOf.get(departmentOf(code)) ?? "other";

export type AvailableGe = {
  course: GeCandidate;
  fills: string[]; // GE categories (or "GE-5") it would add progress to
  alreadyDone: string[]; // its GE categories the student has already covered
  missing: Missing[];
  restriction: RestrictionCheck;
};

export type AvailableGes = {
  results: AvailableGe[];
  // With a subject picked: the GE categories most of that subject's classes count toward that the
  // student has already covered, for a "you've already done this one" reminder.
  coveredInSubject: string[];
};

const OPEN = new Set(["OPEN", "NewOnly"]);

export function availableGes(input: {
  courses: readonly GeCandidate[];
  progress: GeProgress;
  season: Season;
  student: StudentState;
  standing: Standing;
  owned: Set<string>; // taken, credited, or already planned
  scheduleTerm: string | null; // the quarter's label once UCI has posted its Schedule of Classes
  subject: string | null;
  openUnits: number;
  limit?: number; // for "best for me"
}): AvailableGes {
  const open = openNeeds(input.progress);
  // Once the schedule is posted it's the source of truth: offered that quarter, with a seat open.
  // Before then, classes UCI usually offers that season.
  const offered = (c: GeCandidate) =>
    input.scheduleTerm
      ? c.live?.term === input.scheduleTerm && OPEN.has(c.live.status)
      : c.seasons === "*" || c.seasons.includes(SEASON_LETTER[input.season]);
  const subjectPool = input.courses.filter((c) => c.ge.length > 0 && offered(c) && (!input.subject || subjectFor(c.code) === input.subject));

  const takeable: AvailableGe[] = [];
  for (const course of subjectPool) {
    if (input.owned.has(course.id) || redundant(course, input.owned)) continue;
    const status = courseStatus(course, input.student);
    const restriction = checkRestriction(course.restriction, input.standing);
    if (!status.met || restriction.kind === "blocked") continue;
    const f = fills(course, open);
    takeable.push({ course, fills: f, alreadyDone: course.ge.filter((g) => !f.includes(g) && !(g.startsWith("GE-5") && f.includes("GE-5"))), missing: status.missing, restriction });
  }

  if (!input.subject) {
    const byId = new Map(takeable.map((a) => [a.course.id, a]));
    const picks = recommendGes({
      candidates: takeable.map((a) => ({ ...a.course, seasons: "*" })), // already filtered to this quarter
      progress: input.progress,
      season: input.season,
      student: input.student,
      standing: input.standing,
      exclude: new Set(),
      openUnits: input.openUnits,
      limit: input.limit ?? 5,
    });
    return { results: picks.map((p) => ({ ...byId.get(p.course.id)!, fills: p.fills })), coveredInSubject: [] };
  }

  // The subject's usual GE categories: ones at least a quarter of its classes count toward.
  const share = new Map<string, number>();
  for (const c of subjectPool) for (const g of c.ge) share.set(g, (share.get(g) ?? 0) + 1);
  // A Va or Vb class still helps while Category V's three-course total is unfinished.
  const covered = (code: string) => !open.has(code) && !(code.startsWith("GE-5") && open.has("GE-5"));
  const coveredInSubject = [...share].filter(([g, n]) => n >= subjectPool.length / 4 && covered(g)).map(([g]) => g);

  const lowerFirst = input.standing.year <= 2;
  const seats = (a: AvailableGe) => a.course.live?.seatsLeft ?? 0;
  const results = takeable.sort((a, b) =>
    Number(b.fills.length > 0) - Number(a.fills.length > 0) ||
    b.fills.length - a.fills.length ||
    Number(a.restriction.kind === "priority") - Number(b.restriction.kind === "priority") ||
    (lowerFirst ? Number(a.course.number >= 100) - Number(b.course.number >= 100) : 0) ||
    seats(b) - seats(a) ||
    a.course.code.localeCompare(b.course.code));
  return { results, coveredInSubject: GE_CATEGORIES.map((c) => c.code).filter((g) => coveredInSubject.includes(g)) };
}
