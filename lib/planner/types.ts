import type { PrereqTree } from "@/db/schema";

export type CatalogCourse = {
  id: string;
  title: string;
  minUnits: number;
  maxUnits: number;
  prerequisiteTree: PrereqTree | null;
  terms: string[]; // past offerings, e.g. "2024 Fall"
  courseLevel?: string | null; // "Upper Division (100-199)"
  restriction?: string | null; // "Seniors only."
};

export type Catalog = Map<string, CatalogCourse>;

export type Season = "Fall" | "Winter" | "Spring";
export const SEASONS: Season[] = ["Fall", "Winter", "Spring"];

export type PlanOptions = {
  startYear: number; // calendar year of the first Fall quarter
  completed?: string[]; // courses already taken (or transferred in)
  exams?: string[]; // AP/placement exams passed, e.g. "AP CALCULUS BC"
  maxUnitsPerQuarter?: number; // default 16
  balance?: boolean; // spread major courses evenly to leave room for GEs; default true
  quarters?: number; // target plan length, default 12 (4 years)
  maxQuarters?: number; // hard stop when a plan overflows, default 18
  offeredSince?: number; // only trust offerings from this year on; default startYear - 4
};

export type PlannedItem = {
  id: string; // course id, or "placeholder:<n>" for an open elective slot
  title: string;
  units: number;
  reason: string; // why it's in the plan, e.g. "Major: Stats 7 or 67" or "Prerequisite for IN4MATX 121"
  placeholder?: boolean;
  prereqs: string[]; // must be finished in an earlier quarter
  coreqs: string[]; // may be taken the same quarter
};

export type Quarter = {
  season: Season;
  year: number; // calendar year (Winter/Spring fall in the year after their Fall)
  label: string; // "Fall 2026"
  items: PlannedItem[];
  units: number;
};

export type Plan = {
  quarters: Quarter[];
  majorUnitsPerQuarter: number; // the load the balancer settled on

  unscheduled: { item: PlannedItem; reason: string }[];
  warnings: string[];
};
