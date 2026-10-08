// Weekly-calendar helpers: UCI's meeting days ("MWF", "TuTh"), picking one section of each type for
// a course, and spotting time conflicts. Times are minutes after midnight.

export type FinalExam = { month: number; day: number; weekday: string; start: number; end: number; place: string }; // month: 0 = Jan

export type Meeting = { days: number[]; start: number; end: number; place: string }; // days: 0 = Monday
export type Section = {
  code: string; // 5-digit code for WebReg
  type: string; // "Lec", "Dis", "Lab"
  instructors: string[];
  status: string; // OPEN, FULL, Waitl, NewOnly
  seatsLeft: number;
  meetings: Meeting[]; // empty = time to be announced / online
  // The rest of a WebSoc row, for the calendar's hover card. Optional so simple tests stay short.
  num?: string; // section letter or number: "A", "1"
  units?: string;
  enrolled?: number;
  capacity?: number;
  waitlist?: string; // "0 / 60", or "" when there's no waitlist
  restrictions?: string; // codes, e.g. "A and L"
  finalExam?: string; // "Tue Dec 8, 10:30am–12:30pm"
  final?: FinalExam; // the same, as data (for the finals schedule)
  syllabus?: string; // URL
};

const DAY_TOKENS: [string, number][] = [["Tu", 1], ["Th", 3], ["Sa", 5], ["Su", 6], ["M", 0], ["W", 2], ["F", 4]];

export function parseDays(days: string): number[] {
  const out: number[] = [];
  for (let rest = days.trim(); rest; ) {
    const hit = DAY_TOKENS.find(([token]) => rest.startsWith(token));
    if (!hit) break;
    out.push(hit[1]);
    rest = rest.slice(hit[0].length);
  }
  return out.sort((a, b) => a - b);
}

export const minutesOf = (t: { hour: number; minute: number }) => t.hour * 60 + t.minute;

export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
}

const RANK: Record<string, number> = { OPEN: 3, NewOnly: 2, Waitl: 1, FULL: 0 };

// One section of each type (e.g. a lecture and a discussion). Sections the student already chose
// win; otherwise the most enrollable one, earliest listed on ties.
export function chooseSections(sections: Section[], chosen: Set<string>): Section[] {
  const byType = new Map<string, Section[]>();
  for (const s of sections) byType.set(s.type, [...(byType.get(s.type) ?? []), s]);
  return [...byType.values()].map((list) =>
    list.find((s) => chosen.has(s.code)) ??
    [...list].sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0))[0]);
}

export type Block = { courseId: string; label: string; section: Section; day: number; start: number; end: number; place: string };

export function toBlocks(courseId: string, label: string, sections: Section[]): Block[] {
  return sections.flatMap((section) =>
    section.meetings.flatMap((m) => m.days.map((day) => ({ courseId, label, section, day, start: m.start, end: m.end, place: m.place }))));
}

// Pairs of blocks from different courses (or different sections) that overlap on the same day.
export function conflicts(blocks: Block[]): [Block, Block][] {
  const out: [Block, Block][] = [];
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];
      if (a.section.code !== b.section.code && a.day === b.day && a.start < b.end && b.start < a.end) out.push([a, b]);
    }
  return out;
}

// Side-by-side layout for overlapping classes on one day: each block gets a lane, and every block
// in a group of mutually overlapping blocks shares the group's lane count (like a calendar app).
export function layoutLanes<T extends { start: number; end: number }>(blocks: T[]): (T & { lane: number; lanes: number })[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: (T & { lane: number; lanes: number })[] = [];
  let group: (T & { lane: number; lanes: number })[] = [];
  let groupEnd = -1;
  const close = () => {
    const lanes = Math.max(1, ...group.map((b) => b.lane + 1));
    for (const b of group) b.lanes = lanes;
    out.push(...group);
    group = [];
  };
  for (const block of sorted) {
    if (block.start >= groupEnd && group.length) close();
    const busy = new Set(group.filter((b) => b.end > block.start).map((b) => b.lane));
    let lane = 0;
    while (busy.has(lane)) lane++;
    group.push({ ...block, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, block.end);
  }
  if (group.length) close();
  return out;
}

// Final exams for the chosen sections, in date order, plus pairs that overlap.
export type FinalRow = { courseId: string; label: string; final: FinalExam | null; note: string };
export function finalsSchedule(courses: { courseId: string; label: string; sections: Section[] }[]) {
  const rows: FinalRow[] = courses.map((c) => {
    const withFinal = c.sections.find((s) => s.final);
    const note = c.sections.map((s) => s.finalExam).find(Boolean) ?? "Final not announced yet";
    return { courseId: c.courseId, label: c.label, final: withFinal?.final ?? null, note };
  });
  const dated = rows.filter((r) => r.final).sort((a, b) => a.final!.month - b.final!.month || a.final!.day - b.final!.day || a.final!.start - b.final!.start);
  const clashes: [FinalRow, FinalRow][] = [];
  for (let i = 0; i < dated.length; i++)
    for (let j = i + 1; j < dated.length; j++) {
      const a = dated[i].final!;
      const b = dated[j].final!;
      if (a.month === b.month && a.day === b.day && a.start < b.end && b.start < a.end) clashes.push([dated[i], dated[j]]);
    }
  return { dated, undated: rows.filter((r) => !r.final), clashes };
}

// A course's main section type: lectures when it has any (UCI sometimes lists a discussion first),
// otherwise whatever it has (a lab-only or seminar course).
export const mainTypeOf = (sections: Section[]) => (sections.some((s) => s.type === "Lec") ? "Lec" : sections[0]?.type);

// Professors teaching a course's main sections, in listed order.
export function professorsOf(sections: Section[]): string[] {
  const mainType = mainTypeOf(sections);
  return [...new Set(sections.filter((s) => s.type === mainType).flatMap((s) => s.instructors))];
}

// Sections of one type a student can pick once they've chosen a professor: that professor's, if
// they teach any of this type; otherwise all of them (e.g. labs run by TAs).
export function sectionsFor(sections: Section[], type: string, professor: string | null): Section[] {
  const ofType = sections.filter((s) => s.type === type);
  if (!professor) return ofType;
  const theirs = ofType.filter((s) => s.instructors.includes(professor));
  return theirs.length ? theirs : ofType;
}

// Choosing a professor: their most enrollable section of each type they teach; other types keep
// the student's current pick. Returns the course's new section codes.
export function chooseProfessor(sections: Section[], professor: string, current: Set<string>): string[] {
  const types = [...new Set(sections.map((s) => s.type))];
  return types.flatMap((type) => {
    const options = sectionsFor(sections, type, professor);
    const keep = options.find((s) => current.has(s.code));
    return [(keep ?? chooseSections(options, new Set())[0]).code];
  });
}
