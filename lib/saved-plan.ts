// The student's plan, remembered in this browser (localStorage) so it survives closing the tab,
// new deployments, and opening a plain link. Only this device sees it; share links carry it
// elsewhere. Every access is guarded: storage can be unavailable (private mode, blocked cookies).

const KEY = "degreepath:plan";

export type SavedPlan = { path: string; search: string; savedAt: number }; // path: "/plan/BS-19H"

export function loadPlan(): SavedPlan | null {
  try {
    const raw = localStorage.getItem(KEY);
    const plan = raw ? (JSON.parse(raw) as SavedPlan) : null;
    return plan && typeof plan.path === "string" && plan.path.startsWith("/plan/") && typeof plan.search === "string" ? plan : null;
  } catch {
    return null;
  }
}

// An empty search means "back to defaults", so forget the saved plan.
export function savePlan(path: string, search: string): void {
  try {
    if (search) localStorage.setItem(KEY, JSON.stringify({ path, search, savedAt: Date.now() } satisfies SavedPlan));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the plan still lives in the URL
  }
}
