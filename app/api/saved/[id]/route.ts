import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { savedPlans } from "@/db/schema";
import { PLAN_ID, validPlan } from "@/lib/saved-plan-rules";

// GET: the latest saved plan for this id (powers the "My plan link").
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PLAN_ID.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const [row] = await db.select({ path: savedPlans.path, search: savedPlans.search }).from(savedPlans).where(eq(savedPlans.id, id));
  return row ? Response.json(row, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "not found" }, { status: 404 });
}

// PUT: save (or replace) this id's plan.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!PLAN_ID.test(id)) return Response.json({ error: "bad id" }, { status: 400 });
  const plan = validPlan(await req.json().catch(() => null));
  if (!plan) return Response.json({ error: "bad plan" }, { status: 400 });
  await db
    .insert(savedPlans)
    .values({ id, ...plan, updatedAt: new Date() })
    .onConflictDoUpdate({ target: savedPlans.id, set: { path: plan.path, search: plan.search, updatedAt: sql`now()` } });
  return new Response(null, { status: 204 });
}
