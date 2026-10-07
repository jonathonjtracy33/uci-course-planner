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
  geList: string[]; // "GE Ia: Lower Division Writing"
  overlap: string; // "WRITING 45" - can't get credit for both
  sameAs: string; // cross-listed under another department
  repeatabilityType: "times" | "credit_hours" | null; // "May be taken for credit 6 times" / "... for 24 units"
  repeatabilityTimes: number | null;
};

// How many times a course can be taken for credit (1 = not repeatable).
export function maxTimes(c: Pick<ApiCourse, "repeatabilityType" | "repeatabilityTimes" | "minUnits">): number {
  const n = c.repeatabilityTimes ?? 0;
  if (c.repeatabilityType === "times" && n > 1) return n;
  if (c.repeatabilityType === "credit_hours" && n > 0 && c.minUnits > 0) return Math.max(1, Math.floor(n / c.minUnits));
  return 1;
}

export type ApiMajorSummary = { id: string; name: string; type: string; division: string; catalogYear: string };
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
  rewards: { acceptableScores: number[]; coursesGranted: CourseGrant; unitsGranted: number; geGranted: Record<string, number> }[];
};

export const fetchApExams = () => get<ApiApExam[]>("/apExams");

export const fetchMajorList = () => get<ApiMajorSummary[]>("/programs/majors");

// Without catalogYear the API answers from an arbitrary older catalog, so always ask for one.
export const fetchMajor = (programId: string, catalogYear: string) =>
  get<ApiMajor>(`/programs/major?programId=${encodeURIComponent(programId)}&catalogYear=${catalogYear}`);

// "GE Ia: Lower Division Writing" -> "GE-1A", matching the API's geCategory codes.
const ROMAN: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8" };
export function geCode(label: string): string | null {
  const m = label.match(/^GE ([IVX]+)([ab]?)\b/);
  return m && ROMAN[m[1]] ? `GE-${ROMAN[m[1]]}${m[2].toUpperCase()}` : null;
}

export type ApiTerm = { year: string; quarter: string; shortName: string };
export const fetchTerms = () => get<ApiTerm[]>("/websoc/terms");
export const fetchDepartments = () => get<{ deptCode: string; deptName: string }[]>("/websoc/departments");

export type ApiWebsocSection = {
  sectionCode: string;
  sectionType: string;
  status: string;
  maxCapacity: string;
  numCurrentlyEnrolled: { totalEnrolled: string };
  instructors: string[];
  meetings: { timeIsTBA: boolean; days?: string; startTime?: { hour: number; minute: number }; endTime?: { hour: number; minute: number } }[];
};
export type ApiWebsocCourse = { deptCode: string; courseNumber: string; sections: ApiWebsocSection[] };

export async function fetchSchedule(year: string, quarter: string, department: string): Promise<ApiWebsocCourse[]> {
  const data = await get<{ schools: { departments: { courses: ApiWebsocCourse[] }[] }[] }>(
    `/websoc?year=${year}&quarter=${quarter}&department=${encodeURIComponent(department)}`,
  );
  return data.schools.flatMap((s) => s.departments.flatMap((d) => d.courses));
}
