import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import StaticSearchDialog from "@/components/search";
import { fontVariables } from "@/lib/fonts";
import { OG, SITE } from "@/lib/site";
import "./global.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.title} · ${SITE.motto}`, template: `%s · ${SITE.title}` },
  description: SITE.description,
  applicationName: SITE.title,
  referrer: "no-referrer",
  openGraph: {
    siteName: SITE.title,
    type: "website",
    images: [{ url: "/og/home.png", width: OG.width, height: OG.height }],
  },
  twitter: { card: "summary_large_image" },
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
