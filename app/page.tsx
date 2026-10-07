import { Intro } from "@/app/components/intro";
import { MajorSearch } from "@/app/components/major-search";
import { getMajors } from "@/lib/data";

export default async function Home() {
  const majors = await getMajors();
  return (
    <div className="mx-auto max-w-5xl">
      <Intro />
      <section className="intro-after mx-auto max-w-2xl px-4 pb-16" style={{ "--delay": "5.4s" } as React.CSSProperties} aria-labelledby="jump">
        <h2 id="jump" className="text-sm font-semibold text-muted">Already know your major? Jump straight to its plan</h2>
        <div className="mt-3">
          <MajorSearch majors={majors} />
        </div>
      </section>
    </div>
  );
}
