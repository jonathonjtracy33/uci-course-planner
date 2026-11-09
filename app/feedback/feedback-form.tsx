"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { MAX_MESSAGE } from "@/lib/feedback-rules";

const field = "mt-1 w-full rounded-lg border border-border bg-subtle px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

export function FeedbackForm() {
  const from = useSearchParams().get("from");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // hidden from people; bots fill it in
  const [state, setState] = useState<{ kind: "idle" | "sending" | "sent" } | { kind: "error"; text: string }>({ kind: "idle" });

  if (state.kind === "sent") {
    return (
      <div className="mt-8 rounded-xl border border-border bg-brand-soft p-5">
        <p className="font-medium">Thank you! Your feedback was sent. 🙌</p>
        <p className="mt-1 text-sm text-muted">If you left an email, you may hear back once it&apos;s fixed.</p>
        <Link href={from ?? "/"} className="mt-4 inline-block text-sm font-medium text-brand hover:underline">← Back to {from ? "your plan" : "the home page"}</Link>
      </div>
    );
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ kind: "sending" });
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, email, website, page: from }),
    }).catch(() => null);
    if (res?.ok) return setState({ kind: "sent" });
    const body = await res?.json().catch(() => null);
    setState({ kind: "error", text: body?.error ?? "Couldn't send. Check your connection and try again." });
  };

  return (
    <form onSubmit={send} className="mt-8 space-y-4">
      <label className="block text-sm font-medium">
        What happened, or what would make this better?
        <textarea
          required
          minLength={3}
          maxLength={MAX_MESSAGE}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. My major's plan is missing STATS 67, or: it would be great if…"
          className={field}
        />
        <span className="mt-1 block text-right text-xs font-normal text-muted">{message.length}/{MAX_MESSAGE}</span>
      </label>
      <label className="block text-sm font-medium">
        Email <span className="font-normal text-muted">(optional, only if you&apos;d like a reply)</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@uci.edu" className={field} />
      </label>
      <label aria-hidden className="absolute -left-[9999px]">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>
      {state.kind === "error" && <p role="alert" className="text-sm text-red-700">{state.text}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">See what&apos;s stored in the <Link href="/privacy" className="underline hover:text-foreground">privacy note</Link>.</p>
        <button type="submit" disabled={state.kind === "sending"} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-white hover:brightness-110 disabled:opacity-50">
          {state.kind === "sending" ? "Sending…" : "Send feedback"}
        </button>
      </div>
    </form>
  );
}
