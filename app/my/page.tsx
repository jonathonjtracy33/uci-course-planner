import type { Metadata } from "next";
import { OpenMyPlan } from "./open-my-plan";

export const metadata: Metadata = { title: "My plan" };

// "My plan link": /my?id=... opens the latest saved plan on any device or deployment.
export default function MyPlanPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <OpenMyPlan />
    </div>
  );
}
