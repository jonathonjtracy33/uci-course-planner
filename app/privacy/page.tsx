import type { Metadata } from "next";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy", description: `What ${SITE_NAME} stores, and what it doesn't.` };

const UPDATED = "November 2026";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Privacy</h1>
      <p className="mt-1 text-sm text-muted">Last updated {UPDATED}</p>
      <p className="mt-6">
        {SITE_NAME} is a free planning tool built by a UC Irvine student. There are no accounts, and nothing you enter is sold or shared for advertising.
        Here&apos;s exactly what&apos;s kept.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Your plan</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>Your answers (year, major, AP scores, classes you&apos;ve taken or added, and chosen sections) are saved in your browser so your plan is there when you come back.</li>
        <li>A copy is also saved on our server under a random ID, so your plan survives site updates and so <span className="font-medium">&ldquo;Copy my plan link&rdquo;</span> can open it on any device. It isn&apos;t tied to your name or email. Anyone with your plan link can see that plan, so share it only with people you trust.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Feedback</h2>
      <p className="mt-2">
        If you use the <Link href="/feedback" className="text-brand underline">feedback form</Link>, we keep your message, the page you sent it from, and your email if you choose to give one, only to fix problems and reply to you.
        To stop spam, we keep a scrambled (hashed) version of your network address for an hour&apos;s rate limit, not the address itself.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Visitor statistics</h2>
      <p className="mt-2">
        We count page visits with Vercel Web Analytics, which doesn&apos;t use cookies and doesn&apos;t identify you. It tells us things like how many people visited and which pages they used.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Services we rely on</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li><span className="font-medium">Vercel</span> hosts the site, and <span className="font-medium">Neon</span> hosts the database.</li>
        <li>Your browser loads UCI class, calendar and grade data directly from the <a href="https://anteaterapi.com" className="text-brand underline">Anteater API</a>, a student-run public API, which sees those requests as it would for any visitor.</li>
        <li>Links to RateMyProfessors, ASSIST.org and UCI pages take you to those sites, which have their own privacy policies.</li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">Deleting your data</h2>
      <p className="mt-2">
        Clearing your browser&apos;s site data removes the copy in your browser. To delete the server copy or a feedback message, send a request through the <Link href="/feedback" className="text-brand underline">feedback form</Link> with your plan link, and it&apos;ll be removed.
      </p>

      <p className="mt-10 rounded-lg bg-subtle px-4 py-3 text-sm text-muted">
        {SITE_NAME} is unofficial and isn&apos;t affiliated with or endorsed by the University of California. Always confirm your plan with an academic counselor.
      </p>
    </article>
  );
}
