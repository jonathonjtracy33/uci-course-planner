// Live sections for one course from UCI's Schedule of Classes, via the Anteater API (it allows
// browser requests). Cached per page load.
import { clock, minutesOf, parseDays, type Section } from "./calendar";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function finalExam(f: Raw["finalExam"]): string {
  if (!f || f.examStatus !== "SCHEDULED_FINAL" || !f.startTime || !f.endTime || f.month === undefined) return f?.examStatus === "NO_FINAL" ? "No final exam" : "";
  return `${f.dayOfWeek} ${MONTHS[f.month]} ${f.day}, ${clock(minutesOf(f.startTime))}–${clock(minutesOf(f.endTime))}`;
}

type Time = { hour: number; minute: number };
type Raw = {
  sectionCode: string; sectionType: string; sectionNum: string; units: string; status: string; maxCapacity: string;
  numCurrentlyEnrolled: { totalEnrolled: string }; instructors: string[];
  numOnWaitlist: string; numWaitlistCap: string; restrictions: string; webURL: string;
  finalExam?: { examStatus: string; dayOfWeek?: string; month?: number; day?: number; startTime?: Time; endTime?: Time };
  meetings: { timeIsTBA: boolean; days?: string; bldg?: string[]; startTime?: { hour: number; minute: number }; endTime?: { hour: number; minute: number } }[];
};

const cache = new Map<string, Promise<Section[]>>();

// term: "Fall 2026"; code: "I&C SCI 31"
export function fetchSections(term: string, code: string): Promise<Section[]> {
  const key = `${term}|${code}`;
  if (!cache.has(key)) {
    const [quarter, year] = term.split(" ");
    const split = code.lastIndexOf(" ");
    const url = `https://anteaterapi.com/v2/rest/websoc?year=${year}&quarter=${quarter}&department=${encodeURIComponent(code.slice(0, split))}&courseNumber=${encodeURIComponent(code.slice(split + 1))}`;
    cache.set(key, fetch(url)
      .then((r) => r.json())
      .then((body) => (body?.ok ? (body.data.schools as { departments: { courses: { sections: Raw[] }[] }[] }[]) : [])
        .flatMap((s) => s.departments.flatMap((d) => d.courses.flatMap((c) => c.sections)))
        .map((s): Section => ({
          code: s.sectionCode,
          type: s.sectionType,
          instructors: s.instructors.filter((i) => i && i !== "STAFF"),
          status: s.status,
          seatsLeft: Math.max(0, Number(s.maxCapacity) - Number(s.numCurrentlyEnrolled.totalEnrolled || 0)),
          meetings: s.meetings
            .filter((m) => !m.timeIsTBA && m.days && m.startTime && m.endTime)
            .map((m) => ({ days: parseDays(m.days!), start: minutesOf(m.startTime!), end: minutesOf(m.endTime!), place: m.bldg?.[0] ?? "" })),
          num: s.sectionNum,
          units: s.units,
          enrolled: Number(s.numCurrentlyEnrolled.totalEnrolled || 0),
          capacity: Number(s.maxCapacity),
          waitlist: s.numWaitlistCap && s.numWaitlistCap !== "0" ? `${s.numOnWaitlist || 0} / ${s.numWaitlistCap}` : "",
          restrictions: s.restrictions,
          finalExam: finalExam(s.finalExam),
          syllabus: s.webURL || undefined,
        })))
      .catch(() => {
        cache.delete(key);
        return [];
      }));
  }
  return cache.get(key)!;
}

// Average GPA from UCI's public grade data: for this instructor if they've taught the course,
// otherwise for the course overall.
export type GpaInfo = { gpa: number; sections: number; byInstructor: boolean; asCode?: string };

// Departments UCI renamed, so a course's grade history may sit under its old code.
// (Software engineering courses moved from IN4MATX to SWE.)
const FORMER_DEPT: Record<string, string> = { SWE: "IN4MATX" };
const gpaCache = new Map<string, Promise<GpaInfo | null>>();

export function fetchGpa(code: string, instructor: string | undefined): Promise<GpaInfo | null> {
  const key = `${code}|${instructor ?? ""}`;
  if (!gpaCache.has(key)) {
    const split = code.lastIndexOf(" ");
    const dept = code.slice(0, split);
    const num = code.slice(split + 1);
    const get = (d: string, who?: string) =>
      fetch(`https://anteaterapi.com/v2/rest/grades/aggregate?department=${encodeURIComponent(d)}&courseNumber=${encodeURIComponent(num)}${who ? `&instructor=${encodeURIComponent(who)}` : ""}`)
        .then((r) => r.json())
        .then((b) => (b?.ok && b.data.gradeDistribution.averageGPA ? b.data : null));
    gpaCache.set(key, (async () => {
      // This instructor, then everyone; under the current code, then a former one.
      for (const d of [dept, FORMER_DEPT[dept]].filter(Boolean)) {
        const asCode = d === dept ? undefined : `${d} ${num}`;
        const mine = instructor ? await get(d, instructor) : null;
        if (mine) return { gpa: mine.gradeDistribution.averageGPA, sections: mine.sectionList.length, byInstructor: true, asCode };
        const all = await get(d);
        if (all) return { gpa: all.gradeDistribution.averageGPA, sections: all.sectionList.length, byInstructor: false, asCode };
      }
      return null;
    })().catch(() => {
      gpaCache.delete(key);
      return null;
    }));
  }
  return gpaCache.get(key)!;
}
