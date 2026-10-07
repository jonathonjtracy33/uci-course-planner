import type { Metadata } from "next";
import Link from "next/link";
import { Dancing_Script, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Casual handwritten script for the "Welcome" on the home page.
const script = Dancing_Script({
  variable: "--font-script",
  weight: "700",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "DegreePath · Your college path, designed for you", template: "%s · DegreePath" },
  description: "Plan your next quarter and your whole degree at UC Irvine: required courses, GEs you can actually take, live open seats, and a weekly calendar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${script.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid size-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">D</span>
              DegreePath
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          DegreePath is a student project, not affiliated with or endorsed by the University of California. Course data from the{" "}
          <a className="underline hover:text-foreground" href="https://anteaterapi.com">Anteater API</a>. Always confirm your plan with an academic counselor.
        </footer>
      </body>
    </html>
  );
}
