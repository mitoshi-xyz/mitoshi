import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { THEME_INIT } from "@/features/theme/theme";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

const TITLE = "Mitoshi 見通し · Trade privately from anywhere";
const DESCRIPTION =
  "Trade privately from anywhere: Polymarket predictions, perps, US stocks, gold and Solana tokens from shielded ZEC, each trade from a wallet nobody has ever seen.";
/** The link preview (public/og.png), made from the README banner: .github/assets/source/banner.html#og. */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_IMAGE = { url: "/og.png", width: OG_WIDTH, height: OG_HEIGHT, alt: "Mitoshi: trade privately from anywhere" };

export const metadata: Metadata = {
  metadataBase: new URL("https://mitoshi.xyz"),
  title: TITLE,
  description: DESCRIPTION,
  referrer: "no-referrer",
  openGraph: {
    type: "website",
    siteName: "Mitoshi",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG_IMAGE.url] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050505" },
    { media: "(prefers-color-scheme: light)", color: "#F4EEE3" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* A plain inline script, so it is in the HTML verbatim and the CSP allows it by hash (scripts/headers.mjs);
            it sets the theme before the first paint. */}
        <script id="mitoshi-theme" dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
