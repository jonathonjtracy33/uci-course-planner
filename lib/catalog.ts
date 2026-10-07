import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, majors } from "@/db/schema";
import type { Catalog } from "@/lib/planner";

export async function loadCatalog(): Promise<Catalog> {
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
    })
    .from(courses);
  return new Map(rows.map((r) => [r.id, r]));
}

export async function loadMajor(id: string) {
  const [major] = await db.select().from(majors).where(eq(majors.id, id));
  return major ?? null;
}
