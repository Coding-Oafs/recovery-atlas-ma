import type { Metadata, Viewport } from "next";
import "./globals.css";
import { publicSiteUrl } from "@/lib/site";
import { LanguageProvider } from "@/components/language-provider";
import { OfflineSetup } from "@/components/offline-tools";
import { ShortlistProvider } from "@/components/shortlist-tools";
import { SavedProvider } from "@/components/saved-provider";
import { viewModeKey } from "@/lib/view-mode";
export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Recovery Atlas",
    title: "Recovery Atlas · Recovery support across the United States",
  },
  title: "Recovery Atlas · Find your way forward across the United States",
  description:
    "Find recovery meetings, treatment, mental health care and support across all 50 US states, DC and US territories where data is available. Explore sourced listings, payment information and ways to connect.",
  applicationName: "Recovery Atlas",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174c42",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { if (localStorage.getItem(${JSON.stringify(viewModeKey)}) === "dark") document.documentElement.dataset.viewMode = "dark" } catch {}`,
          }}
        />
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body>
        <LanguageProvider>
          <OfflineSetup />
          <SavedProvider>
            <ShortlistProvider>{children}</ShortlistProvider>
          </SavedProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
