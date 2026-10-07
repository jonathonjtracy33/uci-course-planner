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
      <div className="mt-8">
        <MajorSearch majors={majors} />
      </div>
    </div>
  );
}
