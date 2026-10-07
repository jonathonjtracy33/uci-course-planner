import { SEASON_LETTER, type Season } from "./planner/types";

// A compact list of every UCI course, for searching courses taken and picking GEs.
// Sent as arrays rather than objects to keep it small (~9,300 courses).

export type IndexCourse = {
  id: string;
  code: string; // "WRITING 50"
  title: string;
  units: number;
  ge: string[]; // ["GE-1A"]
  seasons: string; // recent offering pattern: "FWS" letters, "*" = offered but no clear pattern, "" = not offered recently
  hasPrereqs: boolean;
  number: number; // numeric part of the course number, for sorting lower-division first
};

export type IndexRow = [string, string, string, number, string, string, 0 | 1, number];

export const encodeCourse = (c: IndexCourse): IndexRow => [c.id, c.code, c.title, c.units, c.ge.join(","), c.seasons, c.hasPrereqs ? 1 : 0, c.number];

export const decodeCourse = ([id, code, title, units, ge, seasons, hasPrereqs, number]: IndexRow): IndexCourse =>
  ({ id, code, title, units, ge: ge ? ge.split(",") : [], seasons, hasPrereqs: hasPrereqs === 1, number });

export const offeredIn = (c: IndexCourse, season: Season) => c.seasons === "*" || c.seasons.includes(SEASON_LETTER[season]);
