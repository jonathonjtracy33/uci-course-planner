// The student's plan, remembered two ways:
//  1. in this browser (localStorage), so it survives closing the tab and new deployments, and a
//     plain link to a plan page picks it back up;
//  2. on the server under a private random id, so the "My plan link" opens the latest plan on any
//     device or deployment address (each Vercel deployment URL is a separate site to the browser).
// Every storage access is guarded: it can be unavailable (private mode, blocked site data).

const KEY = "degreepath:plan";
const ID_KEY = "degreepath:plan-id";

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

function saveLocal(path: string, search: string) {
  try {
    if (search) localStorage.setItem(KEY, JSON.stringify({ path, search, savedAt: Date.now() } satisfies SavedPlan));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the plan still lives in the URL
  }
}

// This browser's private plan id (created on first save).
export function planId(create = true): string | null {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id && create) {
      const bytes = crypto.getRandomValues(new Uint8Array(18));
      id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Opening a "My plan link" on a new device makes that id this browser's id too.
export function adoptPlanId(id: string) {
  try {
    localStorage.setItem(ID_KEY, id);
  } catch {
    // fine: the link still works each time
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

// Save locally right away and to the server shortly after (batching quick edits).
// An empty search means "back to defaults", so the local copy is forgotten.
export function savePlan(path: string, search: string): void {
  saveLocal(path, search);
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const id = planId();
    if (id) fetch(`/api/saved/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, search }), keepalive: true }).catch(() => {});
  }, 800);
}

// Save to the server right now (before handing out the "My plan link"). Returns the id.
export async function saveNow(path: string, search: string): Promise<string | null> {
  saveLocal(path, search);
  const id = planId();
  if (!id) return null;
  try {
    const res = await fetch(`/api/saved/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, search }) });
    return res.ok ? id : null;
  } catch {
    return null;
  }
}

export async function fetchSavedPlan(id: string): Promise<{ path: string; search: string } | null> {
  try {
    const res = await fetch(`/api/saved/${encodeURIComponent(id)}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as { path: string; search: string }) : null;
  } catch {
    return null;
  }
}

// When the local copy is missing (a new deployment address, cleared data), try the server copy.
export async function restorePlan(): Promise<SavedPlan | null> {
  const local = loadPlan();
  if (local) return local;
  const id = planId(false);
  const remote = id ? await fetchSavedPlan(id) : null;
  if (!remote) return null;
  saveLocal(remote.path, remote.search);
  return loadPlan();
}
