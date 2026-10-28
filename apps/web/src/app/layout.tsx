import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { THEME_INIT } from "@/features/theme/theme";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

const TITLE = "Mitoshi 見通し · Trade predictions, stocks and crypto from shielded ZEC";
const DESCRIPTION =
  "Every trade on Polymarket, Hyperliquid or Solana gets a brand-new wallet, funded privately through NEAR Intents. The trade is public; who made it isn't.";
/** The link preview (public/og.png), made from the README banner: .github/assets/source/banner.html#og. */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_IMAGE = {
  url: "/og.png",
  width: OG_WIDTH,
  height: OG_HEIGHT,
  alt: "Mitoshi: trade predictions, stocks and crypto from shielded ZEC",
};

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
  // Added to a Home Screen, Mitoshi opens as its own app, full screen (the status bar is cleared by the safe-area insets).
  appleWebApp: { capable: true, title: "Mitoshi" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Full screen on phones, notch and Dynamic Island included: the shell pads itself by the safe-area insets.
  viewportFit: "cover",
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
