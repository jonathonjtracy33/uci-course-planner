import Link from "next/link";
import { MajorSearch } from "@/app/components/major-search";
import { getMajors } from "@/lib/data";

export default async function Home() {
  const majors = await getMajors();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Your 4 years at UCI, <span className="text-brand">planned in a click.</span>
      </h1>
      <p className="mt-3 text-muted">
        Pick your major and get a quarter-by-quarter plan that orders every prerequisite, only schedules classes when
        they&apos;re actually offered, and leaves room for your GEs.
      </p>
      <Link href="/start" className="mt-8 flex items-center justify-between gap-4 rounded-2xl bg-brand px-5 py-4 text-white shadow-sm hover:brightness-110">
        <span>
          <span className="block text-lg font-semibold">Build my plan, step by step</span>
          <span className="block text-sm text-white/85">Any year at UCI, transfers included. 4 quick questions, then your plan and what to sign up for.</span>
        </span>
        <span aria-hidden className="text-2xl">→</span>
      </Link>
      <h2 className="mt-10 text-sm font-semibold text-muted">Or jump straight to a major</h2>
      <div className="mt-3">
        <MajorSearch majors={majors} />
      </div>
    </div>
  );
}
