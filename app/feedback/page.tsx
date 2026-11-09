import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Feedback", description: "Report a problem or suggest an idea." };

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Send feedback</h1>
      <p className="mt-2 text-muted">
        Found something wrong for your major, or have an idea? Every message is read by the person who builds this site.
      </p>
      <Suspense>
        <FeedbackForm />
      </Suspense>
    </div>
  );
}
