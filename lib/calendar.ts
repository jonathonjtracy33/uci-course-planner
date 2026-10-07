// Weekly-calendar helpers: UCI's meeting days ("MWF", "TuTh"), picking one section of each type for
// a course, and spotting time conflicts. Times are minutes after midnight.

export type Meeting = { days: number[]; start: number; end: number; place: string }; // days: 0 = Monday
export type Section = {
  code: string; // 5-digit code for WebReg
  type: string; // "Lec", "Dis", "Lab"
  instructors: string[];
  status: string; // OPEN, FULL, Waitl, NewOnly
  seatsLeft: number;
  meetings: Meeting[]; // empty = time to be announced / online
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
