"use client";

import { useEffect, useSyncExternalStore } from "react";
import { parseSettings, serializeSettings, type PlanSettings } from "@/lib/plan-settings";
import { loadPlan, savePlan } from "@/lib/saved-plan";

const CHANGE = "degreepath:settings";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

// The URL is the single source of truth. On the server (and during hydration) the query string
// is treated as empty, so the prerendered HTML is the default plan; the browser then re-renders
// with whatever the link carried. Every change is also saved in this browser, and a plan page
// opened with a plain link (no settings in it) picks the saved plan back up.
export function usePlanSettings(defaultEntryYear: number) {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const settings = parseSettings(search, defaultEntryYear);

  useEffect(() => {
    if (window.location.search) return;
    const saved = loadPlan();
    if (!saved) return;
    window.history.replaceState(null, "", `${window.location.pathname}${saved.search}`);
    window.dispatchEvent(new Event(CHANGE));
  }, []);

  const update = (change: Partial<PlanSettings>) => {
    const next = serializeSettings({ ...settings, ...change }, defaultEntryYear);
    window.history.replaceState(null, "", `${window.location.pathname}${next}`);
    savePlan(window.location.pathname, next);
    window.dispatchEvent(new Event(CHANGE));
  };

  return [settings, update] as const;
}
