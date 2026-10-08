import Link from "next/link";
import { ContinuePlan } from "./continue-plan";

const TAGLINE = ["Your", "college", "path,", "designed", "just", "for", "you."];

// The home page hero: "Welcome" written in cursive, then the tagline and the button.
// All CSS animation (see globals.css), so it starts immediately and needs no JavaScript.
export function Intro({ majorNames }: { majorNames: Record<string, string> }) {
  return (
    <section className="relative grid min-h-[68vh] place-items-center px-4 text-center" aria-label="Welcome to DegreePath">
      <svg className="intro-welcome pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-40 w-full max-w-2xl -translate-y-1/2 sm:h-56" viewBox="0 0 700 220" aria-hidden>
        <defs>
          {/* royal blue, navy, grey, black, turquoise: muted and evenly blended for a matte, ink-like look */}
          <linearGradient id="welcome-ink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3657b8" />
            <stop offset="30%" stopColor="#1b2a4e" />
            <stop offset="55%" stopColor="#4b5260" />
            <stop offset="78%" stopColor="#1f2329" />
            <stop offset="100%" stopColor="#2a8f8c" />
          </linearGradient>
          {/* Uncovers the word left to right, like a pen moving across the page. */}
          <clipPath id="welcome-pen">
            <rect className="intro-pen" x="0" y="0" width="700" height="220" />
          </clipPath>
        </defs>
        <text
          clipPath="url(#welcome-pen)"
          x="50%"
          y="62%"
          textAnchor="middle"
          fontFamily="var(--font-script)"
          fontWeight="700"
          fontSize="160"
          fill="url(#welcome-ink)"
          stroke="url(#welcome-ink)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          Welcome
        </text>
      </svg>
      <span className="sr-only">Welcome</span>

      <div>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-6xl">
          {TAGLINE.map((word, i) => (
            <span key={i}>
              <span className={`intro-word ${i >= 3 ? "text-brand" : ""}`} style={{ "--i": i } as React.CSSProperties}>{word}</span>{" "}
            </span>
          ))}
        </h1>
        <p className="intro-after mx-auto mt-5 max-w-xl text-lg text-muted" style={{ "--delay": "4.8s" } as React.CSSProperties}>
          Tell us where you are at UC Irvine. We&apos;ll build your next quarter, with open seats and a weekly calendar, and a plan all the way to graduation.
        </p>
        <div className="intro-after mt-8" style={{ "--delay": "5.1s" } as React.CSSProperties}>
          <Link href="/start" className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-brand/20 transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
            Build My Plan <span aria-hidden>→</span>
          </Link>
          <div>
            <ContinuePlan majorNames={majorNames} />
          </div>
        </div>
        <p className="intro-after mx-auto mt-8 max-w-lg rounded-xl border border-border bg-subtle px-4 py-3 text-sm text-muted" style={{ "--delay": "5.3s" } as React.CSSProperties}>
          <span className="font-medium text-foreground">Transferring from a community college or another school?</span>{" "}
          See which of your courses count at UCI on{" "}
          <a href="https://assist.org/" target="_blank" rel="noreferrer" className="font-medium text-brand underline">ASSIST.org ↗</a>
          {" "}(California&apos;s official transfer-credit site), then add the matching UCI courses in step 6 of Build My Plan.
        </p>
      </div>
    </section>
  );
}
