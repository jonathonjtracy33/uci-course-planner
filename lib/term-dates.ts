// UCI's academic calendar for one quarter (from the Anteater API, which allows browser requests):
// when classes and finals end, and when the Schedule of Classes is published.
export type TermDates = { instructionStart: string; finalsEnd: string; socAvailable: string | null }; // "2027-03-19"

const cache = new Map<string, Promise<TermDates | null>>();

// label: "Winter 2027"
export function fetchTermDates(label: string): Promise<TermDates | null> {
  if (!cache.has(label)) {
    const [quarter, year] = label.split(" ");
    if (quarter === "Summer") return Promise.resolve(null); // summer sessions have their own calendars
    cache.set(label, fetch(`https://anteaterapi.com/v2/rest/calendar?year=${year}&quarter=${quarter}`)
      .then((r) => r.json())
      .then((b) => (b?.ok ? { instructionStart: b.data.instructionStart, finalsEnd: b.data.finalsEnd, socAvailable: b.data.socAvailable ?? null } : null))
      .catch(() => {
        cache.delete(label);
        return null;
      }));
  }
  return cache.get(label)!;
}

// "2026-10-31" -> "Oct 31, 2026" (read as a calendar date, not shifted by time zone)
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// True once the day after finals end has begun, in the student's own time zone.
export function quarterIsOver(dates: TermDates, today: Date): boolean {
  const [y, m, d] = dates.finalsEnd.split("-").map(Number);
  return today >= new Date(y, m - 1, d + 1);
}
