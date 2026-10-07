import type { LiveSummary } from "@/lib/ge-recommend";

const LABEL: Record<string, string> = { OPEN: "Open", FULL: "Full", Waitl: "Waitlist", NewOnly: "New students only" };
const TONE: Record<string, string> = {
  OPEN: "bg-emerald-500/15 text-emerald-700",
  NewOnly: "bg-warn-soft text-warn-ink",
  Waitl: "bg-warn-soft text-warn-ink",
  FULL: "bg-red-500/10 text-red-700",
};

// "Fall 2026: Open · 42 seats · 3 lectures", from UCI's Schedule of Classes.
export function LiveBadge({ live }: { live: LiveSummary }) {
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE[live.status] ?? "bg-subtle text-muted"}`}>
      {live.term}: {LABEL[live.status] ?? live.status}
      {live.status !== "FULL" && <span className="font-normal">· {live.seatsLeft} seat{live.seatsLeft === 1 ? "" : "s"} left</span>}
      <span className="font-normal">· {live.sections} section{live.sections === 1 ? "" : "s"}</span>
    </span>
  );
}
