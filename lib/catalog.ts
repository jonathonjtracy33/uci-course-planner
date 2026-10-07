import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, majors } from "@/db/schema";
import type { Catalog } from "@/lib/planner";

// The catalog is ~9k rows and never changes between ingests, so load it once per process.
let catalog: Promise<Catalog> | null = null;
export function loadCatalog(): Promise<Catalog> {
  catalog ??= fetchCatalog().catch((err) => {
    catalog = null;
    throw err;
  });
  return catalog;
}

async function fetchCatalog(): Promise<Catalog> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      minUnits: courses.minUnits,
      maxUnits: courses.maxUnits,
      prerequisiteTree: courses.prerequisiteTree,
      terms: courses.terms,
      courseLevel: courses.courseLevel,
      restriction: courses.restriction,
      maxTimes: courses.maxTimes,
      courseNumber: courses.courseNumber,
    })
    .from(courses);
  return new Map(rows.map(({ courseNumber, ...r }) => [r.id, { ...r, honors: courseNumber.startsWith("H") }]));
}

export async function loadMajor(id: string) {
  const [major] = await db.select().from(majors).where(eq(majors.id, id));
  return major ?? null;
}
