// A student's choices, stored in the URL so any plan can be shared as a link:
//   /plan/BS-19H?entry=2025&from=3&units=18&taken=I%26CSCI31,MATH2A&ap=AP+Calculus+BC:5&add=WRITING50@0&fill=1
// Defaults are left out so the plain URL is the default plan.

export type PlanSettings = {
  entryYear: number; // first Fall at UCI
  firstQuarter: number; // plan from this many quarters after that Fall
  maxUnits: number;
  taken: string[]; // course ids
  ap: Record<string, number>; // exam name -> score
  hsLanguage: boolean; // three years of one language in high school, which satisfies GE VI
  added: { id: string; quarter: number }[]; // courses the student added (GEs or electives), by quarter index
  fill: boolean; // fill the rest of the 180 units with free-elective slots
  setup: number; // guided setup step being shown on the plan page (0 = none)
  unitsDone: number; // total units completed so far, as the student reports it (0 = count from courses)
  pace: Pace; // on time (4 years), early, or balanced (a steady load, even past 4 years)
  grad: number; // for an early pace: graduate after this many quarters from the first Fall (9 = a year early)
  summer: boolean; // plan summer sessions too (always on for an early pace)
  sections: string[]; // 5-digit section codes chosen for the calendar
};

// The questionnaire: steps 1-4 (college, year, quarter, major) are on /start; the rest on the plan page.
import type { Pace } from "./pace";

export const SETUP_STEPS = { ap: 5, courses: 6, graduation: 7 } as const;
export const TOTAL_STEPS = 7;
export const ON_TIME = 12;
const SEASONS = ["Fall", "Winter", "Spring"] as const;

// "I'm going into my 2nd year, starting Winter 2027" -> first Fall at UCI and the quarter to plan from.
// startFallYear is the calendar year of the Fall that begins the starting term's academic year.
export function fromStanding(yearInCollege: number, startFallYear: number, startSeason: (typeof SEASONS)[number]) {
  return { entryYear: startFallYear - (yearInCollege - 1), firstQuarter: (yearInCollege - 1) * 3 + SEASONS.indexOf(startSeason) };
}

export const UNIT_CHOICES = [12, 13, 14, 15, 16, 17, 18, 19, 20];
export const DEFAULT_MAX_UNITS = 16;

export const defaultSettings = (entryYear: number): PlanSettings => ({ entryYear, firstQuarter: 0, maxUnits: DEFAULT_MAX_UNITS, taken: [], ap: {}, hsLanguage: false, added: [], fill: false, setup: 0, unitsDone: 0, pace: "ontime", grad: ON_TIME, summer: false, sections: [] });

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
    hsLanguage: params.get("lang") === "1",
    added: (params.get("add") ?? params.get("ge") ?? "").split(",").flatMap((entry) => { // "ge" is the older name
      const [id, quarter] = entry.split("@");
      const q = Number(quarter);
      // whole quarters, or .5 for a summer
      return id && Number.isInteger(q * 2) && q >= 0 && q < 18 ? [{ id, quarter: q }] : [];
    }),
    fill: params.get("fill") === "1",
    setup: int(params.get("setup"), 0, 0, 9),
    unitsDone: int(params.get("done"), 0, 0, 400),
    // Older links had only "grad": earlier than 12 meant early, later meant a slower pace.
    pace: params.get("pace") === "early" || params.get("pace") === "balanced"
      ? (params.get("pace") as Pace)
      : int(params.get("grad"), ON_TIME, 6, 18) < ON_TIME ? "early" : int(params.get("grad"), ON_TIME, 6, 18) > ON_TIME ? "balanced" : "ontime",
    grad: int(params.get("grad"), ON_TIME, 6, 18),
    summer: params.get("summer") === "1",
    sections: (params.get("sec") ?? "").split(",").filter((c) => /^\d{5}$/.test(c)),
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
  if (s.hsLanguage) params.set("lang", "1");
  if (s.added.length) params.set("add", s.added.map((g) => `${g.id}@${g.quarter}`).join(","));
  if (s.fill) params.set("fill", "1");
  if (s.setup) params.set("setup", String(s.setup));
  if (s.unitsDone) params.set("done", String(s.unitsDone));
  if (s.pace !== "ontime") params.set("pace", s.pace);
  if (s.pace === "early" && s.grad !== ON_TIME) params.set("grad", String(s.grad));
  if (s.summer) params.set("summer", "1");
  if (s.sections.length) params.set("sec", s.sections.join(","));
  const query = params.toString();
  return query ? `?${query}` : "";
}
