// Pulls every UCI course and undergraduate major from the Anteater API into Neon.
// Run with: npm run ingest (DATABASE_URL comes from .env.local)
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { apExams, courses, majors } from "@/db/schema";
import { fetchAllCourses, fetchApExams, fetchMajor, fetchMajorList, geCode, maxTimes } from "@/lib/anteater";

const CHUNK = 200;

async function ingestCourses() {
  const apiCourses = await fetchAllCourses((n) => process.stdout.write(`\r  fetched ${n} courses`));
  console.log();

  // Overlap text ("WRITING 37.") names courses you can't also get credit for. Match it to real
  // course ids and record it in both directions, since the catalog often lists only one side.
  const ids = new Set(apiCourses.map((c) => c.id));
  const overlaps = new Map<string, Set<string>>();
  for (const c of apiCourses)
    for (const part of `${c.overlap ?? ""},${c.sameAs ?? ""}`.split(/[,;.]|\band\b|\bor\b/)) {
      const other = part.replace(/\s+/g, "");
      if (!other || other === c.id || !ids.has(other)) continue;
      overlaps.set(c.id, (overlaps.get(c.id) ?? new Set()).add(other));
      overlaps.set(other, (overlaps.get(other) ?? new Set()).add(c.id));
    }

  const rows = apiCourses.map((c) => ({
    id: c.id,
    department: c.department,
    courseNumber: c.courseNumber,
    title: c.title,
    minUnits: c.minUnits,
    maxUnits: c.maxUnits,
    description: c.description || null,
    courseLevel: c.courseLevel || null,
    restriction: c.restriction || null,
    prerequisiteText: c.prerequisiteText || null,
    // the API sends {} for "no prerequisites"
    prerequisiteTree: Object.keys(c.prerequisiteTree ?? {}).length ? (c.prerequisiteTree as never) : null,
    terms: c.terms ?? [],
    ge: (c.geList ?? []).map(geCode).filter((g) => g !== null),
    maxTimes: maxTimes(c),
    overlaps: [...(overlaps.get(c.id) ?? [])],
    updatedAt: new Date(),
  }));

  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(courses)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: courses.id,
        set: {
          department: sql`excluded.department`,
          courseNumber: sql`excluded.course_number`,
          title: sql`excluded.title`,
          minUnits: sql`excluded.min_units`,
          maxUnits: sql`excluded.max_units`,
          description: sql`excluded.description`,
          courseLevel: sql`excluded.course_level`,
          restriction: sql`excluded.restriction`,
          prerequisiteText: sql`excluded.prerequisite_text`,
          prerequisiteTree: sql`excluded.prerequisite_tree`,
          terms: sql`excluded.terms`,
          ge: sql`excluded.ge`,
          maxTimes: sql`excluded.max_times`,
          overlaps: sql`excluded.overlaps`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  }
  console.log(`  saved ${rows.length} courses`);
}

async function ingestMajors() {
  const list = (await fetchMajorList()).filter((m) => m.division === "Undergraduate");
  let saved = 0;
  for (const summary of list) {
    try {
      const major = await fetchMajor(summary.id, summary.catalogYear);
      const row = {
        id: major.id,
        name: major.name,
        degreeType: summary.type,
        catalogYear: major.catalogYear,
        requirements: major.requirements,
        updatedAt: new Date(),
      };
      await db
        .insert(majors)
        .values(row)
        .onConflictDoUpdate({ target: majors.id, set: row });
      saved++;
      process.stdout.write(`\r  saved ${saved}/${list.length} majors`);
    } catch (err) {
      console.warn(`\n  skipped ${summary.id} (${summary.name}): ${(err as Error).message}`);
    }
  }
  console.log();
}

async function ingestApExams() {
  const exams = await fetchApExams();
  for (const e of exams) {
    const row = {
      name: e.fullName,
      catalogueName: e.catalogueName,
      rewards: e.rewards.map((r) => ({ scores: r.acceptableScores, courses: r.coursesGranted, units: r.unitsGranted, ge: r.geGranted })),
      updatedAt: new Date(),
    };
    await db.insert(apExams).values(row).onConflictDoUpdate({ target: apExams.name, set: row });
  }
  console.log(`  saved ${exams.length} AP exams`);
}

async function main() {
  console.log("AP exams:");
  await ingestApExams();
  console.log("Courses:");
  await ingestCourses();
  console.log("Majors:");
  await ingestMajors();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
