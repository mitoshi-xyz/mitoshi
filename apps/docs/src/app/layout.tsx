import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import StaticSearchDialog from "@/components/search";
import { DOCS_ORIGIN } from "@/lib/constants";
import { fontVariables } from "@/lib/fonts";
import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL(DOCS_ORIGIN),
  title: { default: "Mitoshi docs", template: "%s · Mitoshi docs" },
  description:
    "How Mitoshi works: a brand-new wallet for every trade on Polymarket, Hyperliquid and Solana, funded from shielded ZEC through NEAR Intents.",
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

/** Dark first, like the app; the reader's choice is kept in this browser only. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          theme={{ defaultTheme: "dark", enableSystem: true, storageKey: "mitoshi-docs-theme" }}
          search={{ SearchDialog: StaticSearchDialog }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
