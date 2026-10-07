// Pulls the newest published term from UCI's Schedule of Classes (via the Anteater API): which
// courses are actually offered, open seats, and section times. Run with: npm run ingest:schedule
import { db } from "@/db";
import { offerings } from "@/db/schema";
import { fetchDepartments, fetchSchedule, fetchTerms } from "@/lib/anteater";
import { summarize } from "@/lib/live";

const REGULAR = ["Fall", "Winter", "Spring"];

async function main() {
  // Terms come newest first; summer sessions don't matter for a 4-year plan.
  const term = (await fetchTerms()).find((t) => REGULAR.includes(t.quarter));
  if (!term) throw new Error("No regular term on the schedule");
  const label = `${term.year} ${term.quarter}`;
  console.log(`Schedule of Classes: ${label}`);

  const departments = await fetchDepartments();
  const rows: (ReturnType<typeof summarize> & { term: string; updatedAt: Date })[] = [];
  for (const [i, d] of departments.entries()) {
    try {
      for (const course of await fetchSchedule(term.year, term.quarter, d.deptCode)) rows.push({ term: label, ...summarize(course), updatedAt: new Date() });
    } catch (err) {
      console.warn(`\n  skipped ${d.deptCode}: ${(err as Error).message}`);
    }
    process.stdout.write(`\r  ${i + 1}/${departments.length} departments, ${rows.length} courses`);
  }
  console.log();
  // Cross-listed courses show up under more than one department; keep one row per course.
  const unique = [...new Map(rows.map((r) => [r.courseId, r])).values()];
  if (unique.length < 500) throw new Error(`Only ${unique.length} courses found; not replacing the saved schedule`);

  // Replace this term's rows and drop older terms.
  await db.delete(offerings);
  for (let i = 0; i < unique.length; i += 200) await db.insert(offerings).values(unique.slice(i, i + 200));
  console.log(`  saved ${unique.length} offered courses for ${label}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
