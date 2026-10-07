import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ZotPath · 4-year plans for UC Irvine majors", template: "%s · ZotPath" },
  description: "Pick your UCI major and get a 4-year course plan that respects every prerequisite and when each class is actually offered.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid size-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">Z</span>
              ZotPath
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          Not affiliated with UC Irvine. Course data from the{" "}
          <a className="underline hover:text-foreground" href="https://anteaterapi.com">Anteater API</a>. Always confirm your plan with an academic counselor.
        </footer>
      </body>
    </html>
  );
}
