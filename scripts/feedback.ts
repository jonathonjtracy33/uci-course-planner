// Prints the newest messages from the feedback form. Run with: npm run feedback
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { feedback } from "@/db/schema";

async function main() {
  const rows = await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(50);
  if (!rows.length) return console.log("No feedback yet.");
  for (const r of rows) {
    console.log(`\n${r.createdAt.toLocaleString()}${r.page ? `  ·  ${r.page}` : ""}${r.email ? `  ·  ${r.email}` : ""}`);
    console.log(`  ${r.message.replace(/\n/g, "\n  ")}`);
  }
}

main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
