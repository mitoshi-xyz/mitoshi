import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/** Installs Mitoshi as an app from the browser (Add to Home Screen, Install app): full screen, opening on Markets. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mitoshi 見通し",
    short_name: "Mitoshi",
    description: "Trade predictions, stocks and crypto from shielded ZEC. A new wallet for every trade.",
    start_url: "/markets",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
