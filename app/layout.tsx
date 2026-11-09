import type { Metadata } from "next";
import Link from "next/link";
import { Dancing_Script, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { DeploymentNotice, ProductionHostProvider } from "./components/site-host";

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

const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// Link previews (Discord, iMessage, Instagram, ...) use these plus app/opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(productionHost ? `https://${productionHost}` : "http://localhost:3000"),
  title: { default: `${SITE_NAME} · ${SITE_TAGLINE}`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: "website", siteName: SITE_NAME, title: `${SITE_NAME} · ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
  twitter: { card: "summary_large_image", title: `${SITE_NAME} · ${SITE_TAGLINE}`, description: SITE_DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${script.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ProductionHostProvider value={productionHost ?? null}>
        <DeploymentNotice />
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span aria-hidden className="grid size-7 place-items-center rounded-md bg-brand text-sm font-bold text-white">{SITE_NAME[0]}</span>
              {SITE_NAME}
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted">
          <p>
            {SITE_NAME} is a student project, not affiliated with or endorsed by the University of California. Course data from the{" "}
            <a className="underline hover:text-foreground" href="https://anteaterapi.com">Anteater API</a>. Always confirm your plan with an academic counselor.
          </p>
          <p className="mt-2 space-x-3">
            <Link href="/feedback" className="font-medium text-brand hover:underline">💬 Send feedback</Link>
            <Link href="/privacy" className="underline hover:text-foreground">Privacy</Link>
          </p>
        </footer>
        </ProductionHostProvider>
        <Analytics />
      </body>
    </html>
  );
}
