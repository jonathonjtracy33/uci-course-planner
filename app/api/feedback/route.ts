import { createHash } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { PER_HOUR, validFeedback } from "@/lib/feedback-rules";

// A salted hash of the sender's IP, so one person can't flood the form, without storing the IP.
function senderOf(req: Request): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${process.env.FEEDBACK_SALT ?? "degreepath"}:${ip}`).digest("hex").slice(0, 32);
}

// POST: save a message from the feedback form.
export async function POST(req: Request) {
  const input = validFeedback(await req.json().catch(() => null));
  if (!input) return Response.json({ error: "Please write a message (up to 2,000 characters) and check your email address." }, { status: 400 });
  const sender = senderOf(req);
  const [recent] = await db
    .select({ n: count() })
    .from(feedback)
    .where(and(eq(feedback.sender, sender), gt(feedback.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if ((recent?.n ?? 0) >= PER_HOUR) return Response.json({ error: "Thanks! You've sent a lot of feedback this hour. Please try again later." }, { status: 429 });
  await db.insert(feedback).values({ ...input, sender });
  return new Response(null, { status: 204 });
}
