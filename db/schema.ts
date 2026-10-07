import { pgTable, text, real, jsonb, timestamp } from "drizzle-orm/pg-core";

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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
