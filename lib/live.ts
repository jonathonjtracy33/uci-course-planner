// Turns UCI Schedule of Classes data into a short summary per course.
import type { LiveSection } from "@/db/schema";
import type { ApiWebsocCourse, ApiWebsocSection } from "@/lib/anteater";

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (t?: { hour: number; minute: number }) => (t ? `${t.hour > 12 ? t.hour - 12 : t.hour}:${pad(t.minute)}${t.hour >= 12 ? "pm" : "am"}` : "");

export function toLiveSection(s: ApiWebsocSection): LiveSection {
  const m = s.meetings.find((x) => !x.timeIsTBA);
  return {
    type: s.sectionType,
    code: s.sectionCode,
    days: m?.days ?? "TBA",
    time: m ? `${clock(m.startTime)}–${clock(m.endTime)}` : "TBA",
    instructors: s.instructors.filter((i) => i && i !== "STAFF"),
    status: s.status,
    seatsLeft: Math.max(0, Number(s.maxCapacity) - Number(s.numCurrentlyEnrolled.totalEnrolled || 0)),
  };
}

const RANK: Record<string, number> = { OPEN: 3, NewOnly: 2, Waitl: 1, FULL: 0 };

// A course's "main" sections are its lectures (or, with no lectures, the first section type
// listed); students enroll in one of those plus any discussion or lab that goes with it. Some
// courses list a discussion first, so "first listed" alone would rate seats by the discussions.
export function summarize(course: ApiWebsocCourse) {
  const sections = course.sections.map(toLiveSection);
  const mainType = sections.some((s) => s.type === "Lec") ? "Lec" : sections[0]?.type;
  const main = sections.filter((s) => s.type === mainType);
  const status = main.reduce((best, s) => ((RANK[s.status] ?? 0) > (RANK[best] ?? 0) ? s.status : best), main[0]?.status ?? "FULL");
  return {
    courseId: `${course.deptCode}${course.courseNumber}`.replace(/\s+/g, ""),
    status,
    seatsLeft: main.reduce((sum, s) => sum + s.seatsLeft, 0),
    sections: sections.slice(0, 12),
  };
}
