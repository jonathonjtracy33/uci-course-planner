"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { loadPlan } from "@/lib/saved-plan";

const never = () => () => {};

// "Continue my plan" on the home page, when this browser has a saved plan.
export function ContinuePlan({ majorNames }: { majorNames: Record<string, string> }) {
  // Read once on the client; the server (and the first render) shows nothing.
  const raw = useSyncExternalStore(never, () => JSON.stringify(loadPlan()), () => "null");
  const saved = JSON.parse(raw) as ReturnType<typeof loadPlan>;
  if (!saved) return null;
  const id = saved.path.split("/").pop() ?? "";
  const name = id === "undeclared" ? "Undeclared" : (majorNames[id] ?? "your major").replace(/^Major in /, "");
  return (
    <Link href={`${saved.path}${saved.search}`} className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand px-6 py-3 font-semibold text-brand hover:bg-brand-soft">
      Continue my plan · {name} <span aria-hidden>→</span>
    </Link>
  );
}
