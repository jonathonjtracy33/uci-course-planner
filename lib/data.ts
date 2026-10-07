import { asc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "@/db";
import { apExams, courses, majors, type PrereqTree, type Requirement } from "@/db/schema";
import { encodeCourse, type IndexRow } from "@/lib/course-index";
import type { GeCandidate } from "@/lib/ge-recommend";
import { buildPlan, type CatalogCourse } from "@/lib/planner";
import type { ApExam } from "@/lib/planner/ap";
import { normalizeCourseId } from "@/lib/planner/prereqs";
import { offeredSeasons } from "@/lib/planner/schedule";

export type MajorSummary = { id: string; name: string; degreeType: string | null };

export async function getMajors(): Promise<MajorSummary[]> {
  "use cache";
  cacheLife("days");
  return db
    .select({ id: majors.id, name: majors.name, degreeType: majors.degreeType })
    .from(majors)
    .where(sql`jsonb_array_length(${majors.requirements}) > 0`)
    .orderBy(asc(majors.name));
}

// What the browser needs to plan: the catalog entry plus a display code like "I&C SCI 46".
export type PlannerCourse = CatalogCourse & { code: string; ge: string[] };
export type CourseDetails = { description: string | null; prerequisiteText: string | null };

export type PlanPage = {
  major: { id: string; name: string; catalogYear: string | null; requirements: Requirement[] };
  courses: PlannerCourse[]; // every course this major could possibly need
  details: Record<string, CourseDetails>; // long text, only for courses in the default plan
  apExams: ApExam[];
  entryYear: number; // default first Fall
  offeredSince: number;
};

// Fall of the current academic year: from July on, plan from this Fall.
const academicStartYear = (now: Date) => (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

const requirementCourses = (reqs: Requirement[]): string[] =>
  reqs.flatMap((r) => (r.requirementType === "Group" ? requirementCourses(r.requirements) : r.courses));

const treeCourses = (tree: PrereqTree | null): string[] => {
  if (!tree) return [];
  if ("prereqType" in tree) return tree.prereqType === "course" ? [normalizeCourseId(tree.courseId)] : [];
  return ("AND" in tree ? tree.AND : "OR" in tree ? tree.OR : tree.NOT).flatMap(treeCourses);
};

export async function getPlanPage(majorId: string): Promise<PlanPage | null> {
  "use cache";
  cacheLife("days");
  const [major] = await db.select().from(majors).where(eq(majors.id, majorId));
  if (!major) return null;

  const entryYear = academicStartYear(new Date());
  const offeredSince = entryYear - 4;

  // Walk requirements and every branch of every prerequisite tree, a level at a time, so the
  // browser gets exactly the courses any choice of options could pull in.
  const subset = new Map<string, PlannerCourse>();
  for (let frontier = [...new Set(requirementCourses(major.requirements))]; frontier.length; ) {
    const rows = await db
      .select({ id: courses.id, title: courses.title, department: courses.department, courseNumber: courses.courseNumber, minUnits: courses.minUnits, maxUnits: courses.maxUnits, prerequisiteTree: courses.prerequisiteTree, terms: courses.terms, courseLevel: courses.courseLevel, restriction: courses.restriction, ge: courses.ge, maxTimes: courses.maxTimes })
      .from(courses)
      .where(inArray(courses.id, frontier));
    for (const r of rows)
      subset.set(r.id, {
        id: r.id,
        code: `${r.department} ${r.courseNumber}`,
        title: r.title,
        minUnits: r.minUnits,
        maxUnits: r.maxUnits,
        prerequisiteTree: r.prerequisiteTree,
        terms: r.terms.filter((t) => Number(t.slice(0, 4)) >= offeredSince), // only recent offerings matter
        courseLevel: r.courseLevel,
        restriction: r.restriction && /seniors only/i.test(r.restriction) ? r.restriction : null, // the only part the planner reads
        maxTimes: r.maxTimes,
        ge: r.ge,
      });
    frontier = [...new Set(rows.flatMap((r) => treeCourses(r.prerequisiteTree)))].filter((id) => !subset.has(id));
  }

  // Long text only for the default plan's courses, to keep the page small.
  const plan = buildPlan(major.requirements, new Map(subset), { startYear: entryYear, offeredSince });
  const planned = [...new Set(plan.quarters.flatMap((q) => q.items).filter((i) => !i.placeholder).map((i) => i.id.split("#")[0]))];
  const detailRows = planned.length
    ? await db.select({ id: courses.id, description: courses.description, prerequisiteText: courses.prerequisiteText }).from(courses).where(inArray(courses.id, planned))
    : [];

  const exams = await db.select({ name: apExams.name, catalogueName: apExams.catalogueName, rewards: apExams.rewards }).from(apExams).orderBy(asc(apExams.name));

  return {
    major: { id: major.id, name: major.name, catalogYear: major.catalogYear, requirements: major.requirements },
    courses: [...subset.values()],
    details: Object.fromEntries(detailRows.map((r) => [r.id, { description: r.description, prerequisiteText: r.prerequisiteText }])),
    apExams: exams,
    entryYear,
    offeredSince,
  };
}

export async function getCourseIndex(): Promise<IndexRow[]> {
  "use cache";
  cacheLife("days");
  const offeredSince = academicStartYear(new Date()) - 4;
  const rows = await db
    .select({ id: courses.id, department: courses.department, courseNumber: courses.courseNumber, title: courses.title, minUnits: courses.minUnits, maxUnits: courses.maxUnits, ge: courses.ge, terms: courses.terms, prerequisiteTree: courses.prerequisiteTree })
    .from(courses)
    .orderBy(asc(courses.id));
  return rows.map((r) => {
    const recent = r.terms.some((t) => Number(t.slice(0, 4)) >= offeredSince);
    const seasons = offeredSeasons(r.terms, offeredSince);
    return encodeCourse({
      id: r.id,
      code: `${r.department} ${r.courseNumber}`,
      title: r.title,
      units: r.minUnits > 0 ? r.minUnits : r.maxUnits,
      ge: r.ge,
      seasons: seasons ? [...seasons].map((s) => s[0]).join("") : recent ? "*" : "",
      hasPrereqs: r.prerequisiteTree !== null,
      number: parseInt(r.courseNumber, 10) || 0,
    });
  });
}

// Details the GE picker needs (prerequisites, restrictions) for every GE course offered recently.
export async function getGeCourses(): Promise<GeCandidate[]> {
  "use cache";
  cacheLife("days");
  const offeredSince = academicStartYear(new Date()) - 4;
  const rows = await db
    .select({ id: courses.id, department: courses.department, courseNumber: courses.courseNumber, title: courses.title, minUnits: courses.minUnits, maxUnits: courses.maxUnits, ge: courses.ge, terms: courses.terms, prerequisiteTree: courses.prerequisiteTree, prerequisiteText: courses.prerequisiteText, restriction: courses.restriction, overlaps: courses.overlaps })
    .from(courses)
    .where(sql`cardinality(${courses.ge}) > 0`)
    .orderBy(asc(courses.id));
  return rows
    .filter((r) => r.terms.some((t) => Number(t.slice(0, 4)) >= offeredSince))
    .map((r) => {
      const seasons = offeredSeasons(r.terms, offeredSince);
      return {
        id: r.id,
        code: `${r.department} ${r.courseNumber}`,
        title: r.title,
        units: r.minUnits > 0 ? r.minUnits : r.maxUnits,
        ge: r.ge,
        seasons: seasons ? [...seasons].map((s) => s[0]).join("") : "*",
        number: parseInt(r.courseNumber, 10) || 0,
        prerequisiteTree: r.prerequisiteTree,
        prerequisiteText: r.prerequisiteText || null,
        restriction: r.restriction,
        overlaps: r.overlaps,
      };
    });
}
