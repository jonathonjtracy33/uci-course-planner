// What the feedback form accepts. Kept separate from the route so it can be tested.
export const MAX_MESSAGE = 2000;
export const MAX_EMAIL = 200;
export const PER_HOUR = 5; // messages one sender can send in an hour

export type FeedbackInput = { message: string; email: string | null; page: string | null };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the cleaned-up feedback, or null if it isn't acceptable. "website" is a hidden field
// that people never see; bots that fill in every field get dropped.
export function validFeedback(body: unknown): FeedbackInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.website === "string" && b.website.trim()) return null;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length < 3 || message.length > MAX_MESSAGE) return null;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  if (email && (email.length > MAX_EMAIL || !EMAIL.test(email))) return null;
  const page = typeof b.page === "string" && b.page.startsWith("/") ? b.page.slice(0, 200) : null;
  return { message, email: email || null, page };
}
