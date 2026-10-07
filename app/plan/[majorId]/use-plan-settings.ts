"use client";

import { useSyncExternalStore } from "react";
import { parseSettings, serializeSettings, type PlanSettings } from "@/lib/plan-settings";

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
// with whatever the link carried.
export function usePlanSettings(defaultEntryYear: number) {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const settings = parseSettings(search, defaultEntryYear);

  const update = (change: Partial<PlanSettings>) => {
    const next = serializeSettings({ ...settings, ...change }, defaultEntryYear);
    window.history.replaceState(null, "", `${window.location.pathname}${next}`);
    window.dispatchEvent(new Event(CHANGE));
  };

  return [settings, update] as const;
}
