import { asc, inArray, sql } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { db } from "@/db";
import { courses, majors } from "@/db/schema";
import { loadCatalog, loadMajor } from "@/lib/catalog";
import { buildPlan, type Plan, type Season } from "@/lib/planner";
import { baseId, offeredSeasons } from "@/lib/planner/schedule";

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

export type CourseInfo = {
  code: string; // "I&C SCI 46"
  description: string | null;
  prerequisiteText: string | null;
  seasons: Season[]; // offered recently; empty = no recent data
};

export type PlanPage = {
  major: { id: string; name: string; catalogYear: string | null };
  plan: Plan;
  info: Record<string, CourseInfo>;
};

// Fall of the current academic year: from July on, plan from this Fall.
const academicStartYear = (now: Date) => (now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1);

export async function getPlanPage(majorId: string): Promise<PlanPage | null> {
  "use cache";
  cacheLife("days");
  const [major, catalog] = await Promise.all([loadMajor(majorId), loadCatalog()]);
  if (!major) return null;

  const startYear = academicStartYear(new Date());
  const plan = buildPlan(major.requirements, catalog, { startYear });

  const ids = [...new Set(plan.quarters.flatMap((q) => q.items).concat(plan.unscheduled.map((u) => u.item)).filter((i) => !i.placeholder).map((i) => baseId(i.id)))];
  const rows = ids.length
    ? await db
        .select({ id: courses.id, department: courses.department, courseNumber: courses.courseNumber, description: courses.description, prerequisiteText: courses.prerequisiteText, terms: courses.terms })
        .from(courses)
        .where(inArray(courses.id, ids))
    : [];
  const order: Season[] = ["Fall", "Winter", "Spring"];
  const info = Object.fromEntries(rows.map((r) => [r.id, {
    code: `${r.department} ${r.courseNumber}`,
    description: r.description,
    prerequisiteText: r.prerequisiteText,
    seasons: order.filter((s) => offeredSeasons(r.terms, startYear - 4)?.has(s)),
  } satisfies CourseInfo]));

  return { major: { id: major.id, name: major.name, catalogYear: major.catalogYear }, plan, info };
}
