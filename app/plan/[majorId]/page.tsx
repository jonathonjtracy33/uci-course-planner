import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getMajors, getPlanPage } from "@/lib/data";
import { PlanView } from "./plan-view";

export async function generateStaticParams() {
  const majors = await getMajors();
  return majors.map((m) => ({ majorId: m.id }));
}

export async function generateMetadata({ params }: PageProps<"/plan/[majorId]">): Promise<Metadata> {
  const { majorId } = await params;
  const page = await getPlanPage(majorId);
  return { title: page ? page.major.name.replace(/^Major in /, "") : "Major not found" };
}

async function Plan({ params }: Pick<PageProps<"/plan/[majorId]">, "params">) {
  const { majorId } = await params;
  const page = await getPlanPage(majorId);
  if (!page) notFound();
  return <PlanView {...page} />;
}

function PlanSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading plan">
      <div className="h-8 w-2/3 rounded bg-border" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-40 rounded-xl bg-border" />)}
      </div>
    </div>
  );
}

export default function PlanPage(props: PageProps<"/plan/[majorId]">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-muted hover:text-brand">← All majors</Link>
      <div className="mt-4">
        <Suspense fallback={<PlanSkeleton />}>
          <Plan params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}
