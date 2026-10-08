"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

// The site's main address (e.g. "uci-course-planner.vercel.app"), from Vercel at build time.
const ProductionHost = createContext<string | null>(null);
export const ProductionHostProvider = ProductionHost.Provider;
export const useProductionHost = () => useContext(ProductionHost);

const never = () => () => {};

// Each Vercel deployment also has its own address, and browsers keep saved data separately per
// address. On one of those, point students to the main site, where their plan is saved.
export function DeploymentNotice() {
  const production = useProductionHost();
  const host = useSyncExternalStore(never, () => window.location.host, () => null);
  if (!production || !host || host === production || host.startsWith("localhost")) return null;
  return (
    <div className="bg-warn-soft px-4 py-2 text-center text-sm text-warn-ink">
      This is a one-off deployment address, so your saved plan isn&apos;t here.{" "}
      <a href={`https://${production}${typeof window !== "undefined" ? window.location.pathname : ""}`} className="font-semibold underline">
        Open DegreePath at {production}
      </a>
    </div>
  );
}
