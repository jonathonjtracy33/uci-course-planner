// Prints a 4-year plan for a major, e.g.: npm run plan -- BS-19H
import { loadCatalog, loadMajor } from "@/lib/catalog";
import { buildPlan } from "@/lib/planner";

async function main() {
  const majorId = process.argv[2] ?? "BS-19H";
  const [major, catalog] = await Promise.all([loadMajor(majorId), loadCatalog()]);
  if (!major) throw new Error(`No major with id ${majorId}`);

  const started = performance.now();
  const plan = buildPlan(major.requirements, catalog, { startYear: new Date().getFullYear() });
  const ms = (performance.now() - started).toFixed(0);

  console.log(`${major.name} (${major.catalogYear}), planned in ${ms} ms\n`);
  for (const q of plan.quarters) {
    console.log(`${q.label.padEnd(12)} ${String(q.units).padStart(2)} units`);
    for (const i of q.items) console.log(`    ${i.placeholder ? "[elective]" : i.id.padEnd(12)} ${i.title.slice(0, 48).padEnd(48)} ${i.reason}`);
  }
  for (const u of plan.unscheduled) console.log(`UNSCHEDULED ${u.item.id}: ${u.reason}`);
  for (const w of plan.warnings) console.log(`WARNING ${w}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
