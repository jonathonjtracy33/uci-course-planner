"use client";

import { useState } from "react";
import { useProductionHost } from "@/app/components/site-host";
import { saveNow } from "@/lib/saved-plan";

// Copies a private link that always opens this student's latest plan, on any device.
export function MyPlanLink() {
  const production = useProductionHost();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const id = await saveNow(window.location.pathname, window.location.search);
    if (!id) return setState("failed");
    const url = `https://${production ?? window.location.host}/my?id=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      window.prompt("Copy your plan link:", url);
      setState("copied");
    }
    setTimeout(() => setState("idle"), 2500);
  };
  return (
    <button type="button" onClick={copy} className="font-medium text-brand hover:underline" title="A private link to your latest plan. Bookmark it to open your plan on any device.">
      {state === "copied" ? "✓ Link copied: bookmark it" : state === "failed" ? "Couldn't save. Try again" : "🔗 Copy my plan link"}
    </button>
  );
}
