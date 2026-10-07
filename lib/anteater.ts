// Thin client for the free Anteater API (https://anteaterapi.com). No key needed; limit is 1000 requests/hour.
import type { PrereqTree, Requirement } from "@/db/schema";
import type { CourseGrant } from "@/lib/planner/ap";

const BASE = "https://anteaterapi.com/v2/rest";

async function get<T>(path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}${path}`);
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) return body.data as T;
    if (attempt >= 3) throw new Error(`Anteater API ${path}: ${res.status} ${body?.message ?? ""}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

export type ApiCourse = {
  id: string; // "I&CSCI46"
  department: string; // "I&C SCI"
  courseNumber: string;
  title: string;
  minUnits: number;
  maxUnits: number;
  description: string;
  courseLevel: string;
  restriction: string;
  prerequisiteText: string;
  prerequisiteTree: PrereqTree | Record<string, never>;
  terms: string[];
};

export type ApiMajorSummary = { id: string; name: string; type: string; division: string };
export type ApiMajor = { id: string; name: string; catalogYear: string; requirements: Requirement[] };

// Prereq trees write course ids with spaces ("I&C SCI 46"); everything else drops them ("I&CSCI46").
export const normalizeCourseId = (id: string) => id.replace(/\s+/g, "");

export async function fetchAllCourses(onPage?: (count: number) => void): Promise<ApiCourse[]> {
  const all: ApiCourse[] = [];
  for (let skip = 0; ; skip += 100) {
    const page = await get<ApiCourse[]>(`/courses?take=100&skip=${skip}`);
    all.push(...page);
    onPage?.(all.length);
    if (page.length < 100) return all;
  }
}

export type ApiApExam = {
  fullName: string;
  catalogueName: string | null;
  rewards: { acceptableScores: number[]; coursesGranted: CourseGrant }[];
};

export const fetchApExams = () => get<ApiApExam[]>("/apExams");

export const fetchMajorList = () => get<ApiMajorSummary[]>("/programs/majors");

export const fetchMajor = (programId: string) =>
  get<ApiMajor>(`/programs/major?programId=${encodeURIComponent(programId)}`);
