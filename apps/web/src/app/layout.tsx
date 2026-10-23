import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { THEME_INIT } from "@/features/theme/theme";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mitoshi 見通し · Trade privately from anywhere",
  description:
    "Trade privately from anywhere: Polymarket predictions, perps, US stocks, gold and Solana tokens from shielded ZEC, each trade from a wallet nobody has ever seen.",
  referrer: "no-referrer",
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
