"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adoptPlanId, fetchSavedPlan, savePlan } from "@/lib/saved-plan";
import { PLAN_ID } from "@/lib/saved-plan-rules";

export function OpenMyPlan() {
  const router = useRouter();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    let cancelled = false;
    (PLAN_ID.test(id) ? fetchSavedPlan(id) : Promise.resolve(null)).then((plan) => {
      if (cancelled) return;
      if (!plan) return setMissing(true);
      adoptPlanId(id); // keep saving to the same plan from this browser
      savePlan(plan.path, plan.search);
      router.replace(`${plan.path}${plan.search}`);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (missing)
    return (
      <>
        <h1 className="text-2xl font-semibold">We couldn&apos;t find that plan</h1>
        <p className="mt-2 text-muted">Check that you copied the whole link. You can always start a new one.</p>
        <Link href="/start" className="mt-6 inline-block rounded-xl bg-brand px-5 py-3 font-medium text-white">Build My Plan</Link>
      </>
    );
  return <p className="text-muted">Opening your plan…</p>;
}
