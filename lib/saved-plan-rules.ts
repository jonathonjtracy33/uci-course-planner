// What a saved plan may look like (checked on the server before saving).
export const PLAN_ID = /^[A-Za-z0-9_-]{20,64}$/;
export const PLAN_PATH = /^\/plan\/[A-Za-z0-9-]{1,40}$/;
export const MAX_SEARCH = 4000;

export function validPlan(body: unknown): { path: string; search: string } | null {
  if (!body || typeof body !== "object") return null;
  const { path, search } = body as Record<string, unknown>;
  if (typeof path !== "string" || !PLAN_PATH.test(path)) return null;
  if (typeof search !== "string" || search.length > MAX_SEARCH || (search && !search.startsWith("?"))) return null;
  return { path, search };
}
