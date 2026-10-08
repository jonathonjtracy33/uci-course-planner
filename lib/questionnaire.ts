// The 7-step questionnaire spans two pages: steps 1-4 (college, year, quarter, major) on /start and
// steps 5-7 (AP, courses, graduation) on the plan page. Every answer lives in the URL, so moving
// back and forth (or jumping to any step) never loses anything.

import { TOTAL_STEPS } from "./plan-settings";

export const STEP_NAMES = ["College", "Year", "Quarter", "Major", "AP exams", "Courses taken", "Graduation"];
export { TOTAL_STEPS };

// Keys only the /start page uses; everything else is a plan setting and is carried along untouched.
const START_KEYS = ["step", "college", "yr", "tr", "t", "major"];

export function withoutKeys(search: string, keys: string[]): URLSearchParams {
  const params = new URLSearchParams(search);
  for (const k of keys) params.delete(k);
  return params;
}

// Link to a /start step, keeping every plan setting and the student's current answers.
export function startHref(step: number, answers: { yr?: number; tr?: boolean; t?: string; major?: string }, planSearch: string): string {
  const params = withoutKeys(planSearch, [...START_KEYS, "setup"]);
  params.set("step", String(step));
  params.set("college", "uci");
  if (answers.yr) params.set("yr", String(answers.yr));
  if (answers.tr) params.set("tr", "1");
  if (answers.t) params.set("t", answers.t);
  if (answers.major) params.set("major", answers.major);
  return `/start?${params}`;
}

// Link to a plan-page step (5-7), carrying plan settings and replacing year/quarter if given.
export function planHref(major: string, startSearch: string, change: Record<string, string | null>): string {
  const params = withoutKeys(startSearch, START_KEYS);
  for (const [k, v] of Object.entries(change)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }
  return `/plan/${major}?${params}`;
}
