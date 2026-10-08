// What could go wrong if a student adds a course to a quarter. An empty list means it works.
import { redundant, type GeCandidate } from "./ge-recommend";
import { courseStatus, type Missing, type StudentState } from "./prereq-status";
import { checkRestriction, type Standing } from "./restrictions";

export type AddIssue =
  | { kind: "owned"; message: string }
  | { kind: "not-offered"; message: string }
  | { kind: "prereqs"; message: string; missing: Missing[] }
  | { kind: "restricted"; message: string }
  | { kind: "units"; message: string }
  | { kind: "conflict"; message: string };

export function checkAddition(input: {
  course: { id: string; code: string; units: number };
  details: GeCandidate | null; // prerequisites, restrictions, overlaps (null if not known)
  quarterLabel: string;
  offered: boolean | null; // on the posted schedule / usually offered that season; null = unknown
  scheduleKnown: boolean; // `offered` comes from the posted Schedule of Classes
  student: StudentState;
  standing: Standing;
  owned: Set<string>; // taken, credited, or already planned
  unitsPlanned: number;
  maxUnits: number;
}): AddIssue[] {
  const { course, details } = input;
  const issues: AddIssue[] = [];
  if (input.owned.has(course.id)) issues.push({ kind: "owned", message: `${course.code} is already taken or in your plan.` });
  else if (details && redundant(details, input.owned)) issues.push({ kind: "owned", message: `${course.code} overlaps a course you've taken or planned, so it may not earn credit.` });

  if (input.offered === false)
    issues.push({ kind: "not-offered", message: input.scheduleKnown ? `${course.code} isn't on the ${input.quarterLabel} Schedule of Classes.` : `UCI doesn't usually offer ${course.code} in ${input.quarterLabel.split(" ")[0]}.` });

  if (details) {
    const status = courseStatus(details, input.student);
    if (!status.met) issues.push({ kind: "prereqs", message: `${course.code} has prerequisites you won't have finished by ${input.quarterLabel}.`, missing: status.missing });
    const r = checkRestriction(details.restriction, input.standing);
    if (r.kind === "blocked") issues.push({ kind: "restricted", message: `Restricted: ${r.text}` });
  }

  if (input.unitsPlanned + course.units > input.maxUnits)
    issues.push({ kind: "units", message: `That makes ${input.unitsPlanned + course.units} units, over your ${input.maxUnits}-unit limit.` });
  return issues;
}
