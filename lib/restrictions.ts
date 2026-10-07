// Enrollment restrictions are free text. Sort them into what they mean for one student:
//   blocked  - the student can't enroll ("Honors Collegium only", "Seniors only" in year 2)
//   priority - anyone can enroll, but others get seats first ("... have first consideration")
//   ok       - a restriction the student meets ("Anthropology majors only" for an Anthropology major)

export type RestrictionCheck = { kind: "none" | "ok" | "priority" | "blocked"; text: string };
export type Standing = { year: number; majorName: string }; // year 1-4 in that quarter

const STANDING: [RegExp, (year: number) => boolean][] = [
  [/freshm[ae]n only/i, (y) => y === 1],
  [/lower-division students only/i, (y) => y <= 2],
  [/upper-division students only/i, (y) => y >= 3],
  [/seniors only/i, (y) => y >= 4],
];

const majorTopic = (majorName: string) => majorName.replace(/^Major in /, "").replace(/\s*\(.*\)$/, "").toLowerCase();

export function checkRestriction(text: string | null | undefined, who: Standing): RestrictionCheck {
  if (!text) return { kind: "none", text: "" };
  if (/first consideration|priority/i.test(text)) return { kind: "priority", text };
  for (const [pattern, allowed] of STANDING) if (pattern.test(text)) return { kind: allowed(who.year) ? "ok" : "blocked", text };
  if (/^no /i.test(text)) return { kind: "ok", text }; // "No School of Biological Sciences students": only excludes others
  if (/\bonly\b/i.test(text)) return { kind: text.toLowerCase().includes(majorTopic(who.majorName)) ? "ok" : "blocked", text };
  return { kind: "priority", text }; // anything else: show it, but don't treat it as a hard stop
}
