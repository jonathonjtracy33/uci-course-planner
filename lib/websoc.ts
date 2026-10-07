// Live sections for one course from UCI's Schedule of Classes, via the Anteater API (it allows
// browser requests). Cached per page load.
import { minutesOf, parseDays, type Section } from "./calendar";

type Raw = {
  sectionCode: string; sectionType: string; status: string; maxCapacity: string;
  numCurrentlyEnrolled: { totalEnrolled: string }; instructors: string[];
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
        })))
      .catch(() => {
        cache.delete(key);
        return [];
      }));
  }
  return cache.get(key)!;
}
