import type { Metadata } from "next";
import { getMajors } from "@/lib/data";
import { StartFlow } from "./start-flow";

export const metadata: Metadata = { title: "Build my plan" };

export default async function StartPage() {
  const majors = await getMajors();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <StartFlow majors={majors} />
    </div>
  );
}
