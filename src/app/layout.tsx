import type { Metadata, Viewport } from "next";
import "./globals.css";
import { publicSiteUrl } from "@/lib/site";
export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Recovery Atlas",
    title: "Recovery Atlas · Recovery support across the Northeast",
  },
  title: "Recovery Atlas · Find your way forward in the Northeast",
  description:
    "Find recovery meetings, treatment, mental health care and support across CT, MA, ME, NH, NJ, NY, PA, RI and VT. Explore sourced listings, payment information and ways to connect.",
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
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/fonts/fonts.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
