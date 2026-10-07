import { pgTable, text, real, integer, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";
import type { ApExam } from "@/lib/planner/ap";

// A prerequisite tree as the Anteater API returns it, e.g.
// { AND: [{ prereqType: "course", courseId: "I&C SCI 46", ... }, { OR: [...] }] }
export type PrereqLeaf =
  | { prereqType: "course"; courseId: string; coreq: boolean; minGrade?: string }
  | { prereqType: "exam"; examName: string; minGrade?: string };
export type PrereqTree = PrereqLeaf | { AND: PrereqTree[] } | { OR: PrereqTree[] } | { NOT: PrereqTree[] };

// A major requirement block: either "take N of these courses" or "satisfy N of these sub-groups"
export type Requirement =
  | { label: string; requirementType: "Course"; courseCount: number; courses: string[] }
  | { label: string; requirementType: "Group"; requirementCount: number; requirements: Requirement[] }
  | { label: string; requirementType: "Unit"; unitCount: number; courses: string[] };

export const majors = pgTable("majors", {
  id: text("id").primaryKey(), // e.g. "BS-19H"
  name: text("name").notNull(), // e.g. "Major in Informatics"
  degreeType: text("degree_type"), // "B.S.", "B.A."
  catalogYear: text("catalog_year"),
  requirements: jsonb("requirements").$type<Requirement[]>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const courses = pgTable("courses", {
  id: text("id").primaryKey(), // e.g. "I&CSCI46" (no spaces)
  department: text("department").notNull(), // "I&C SCI"
  courseNumber: text("course_number").notNull(), // "46"
  title: text("title").notNull(),
  minUnits: real("min_units").notNull(),
  maxUnits: real("max_units").notNull(),
  description: text("description"),
  courseLevel: text("course_level"), // "Lower Division (1-99)", "Upper Division (100-199)", ...
  restriction: text("restriction"), // enrollment restrictions, e.g. "Seniors only."
  prerequisiteText: text("prerequisite_text"),
  prerequisiteTree: jsonb("prerequisite_tree").$type<PrereqTree | null>(),
  terms: text("terms").array().notNull(), // past offerings, e.g. ["2024 Fall", "2025 Winter"]
  ge: text("ge").array().notNull().default([]),
  maxTimes: integer("max_times").notNull().default(1), // how many times it can be taken for credit
  overlaps: text("overlaps").array().notNull().default([]), // courses you can't also get credit for (both directions) // GE categories it satisfies, e.g. ["GE-2", "GE-8"]
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// UCI's AP credit rules, e.g. AP Calculus BC (4 or 5) grants MATH 2A and 2B.
export const apExams = pgTable("ap_exams", {
  name: text("name").primaryKey(), // "AP Calculus BC"
  catalogueName: text("catalogue_name"), // "AP CALCULUS BC", as prerequisite trees spell it
  rewards: jsonb("rewards").$type<ApExam["rewards"]>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One meeting section from UCI's Schedule of Classes, trimmed to what students choose by.
export type LiveSection = {
  type: string; // "Lec", "Dis", "Lab"
  code: string; // 5-digit section code used to enroll in WebReg
  days: string; // "TuTh"
  time: string; // "11:00-12:20"
  instructors: string[];
  status: string; // "OPEN", "FULL", "Waitl", "NewOnly"
  seatsLeft: number;
};

// What's actually on the schedule for the newest published term (from UCI's Schedule of Classes).
export const offerings = pgTable("offerings", {
  term: text("term").notNull(), // "2026 Fall"
  courseId: text("course_id").notNull(),
  status: text("status").notNull(), // best status across the main (usually lecture) sections
  seatsLeft: integer("seats_left").notNull(), // open seats across the main sections
  sections: jsonb("sections").$type<LiveSection[]>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.term, t.courseId] })]);
