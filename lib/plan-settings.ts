// A student's choices, stored in the URL so any plan can be shared as a link:
//   /plan/BS-19H?entry=2025&from=3&units=18&taken=I%26CSCI31,MATH2A&ap=AP+Calculus+BC:5
// Defaults are left out so the plain URL is the default plan.

export type PlanSettings = {
  entryYear: number; // first Fall at UCI
  firstQuarter: number; // plan from this many quarters after that Fall
  maxUnits: number;
  taken: string[]; // course ids
  ap: Record<string, number>; // exam name -> score
};

export const UNIT_CHOICES = [12, 13, 14, 15, 16, 17, 18, 19, 20];
export const DEFAULT_MAX_UNITS = 16;

export const defaultSettings = (entryYear: number): PlanSettings => ({ entryYear, firstQuarter: 0, maxUnits: DEFAULT_MAX_UNITS, taken: [], ap: {} });

const int = (value: string | null, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return value !== null && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};

export function parseSettings(search: string, defaultEntryYear: number): PlanSettings {
  const params = new URLSearchParams(search);
  const ap: Record<string, number> = {};
  for (const entry of (params.get("ap") ?? "").split("|").filter(Boolean)) {
    const split = entry.lastIndexOf(":"); // exam names can contain colons ("AP Physics C: Mechanics")
    const score = Number(entry.slice(split + 1));
    if (split > 0 && score >= 1 && score <= 5) ap[entry.slice(0, split)] = score;
  }
  return {
    entryYear: int(params.get("entry"), defaultEntryYear, defaultEntryYear - 6, defaultEntryYear + 2),
    firstQuarter: int(params.get("from"), 0, 0, 11),
    maxUnits: int(params.get("units"), DEFAULT_MAX_UNITS, UNIT_CHOICES[0], UNIT_CHOICES.at(-1)!),
    taken: [...new Set((params.get("taken") ?? "").split(",").filter(Boolean))],
    ap,
  };
}

export function serializeSettings(s: PlanSettings, defaultEntryYear: number): string {
  const params = new URLSearchParams();
  if (s.entryYear !== defaultEntryYear) params.set("entry", String(s.entryYear));
  if (s.firstQuarter) params.set("from", String(s.firstQuarter));
  if (s.maxUnits !== DEFAULT_MAX_UNITS) params.set("units", String(s.maxUnits));
  if (s.taken.length) params.set("taken", [...s.taken].sort().join(","));
  const ap = Object.entries(s.ap).sort(([a], [b]) => a.localeCompare(b));
  if (ap.length) params.set("ap", ap.map(([name, score]) => `${name}:${score}`).join("|"));
  const query = params.toString();
  return query ? `?${query}` : "";
}
