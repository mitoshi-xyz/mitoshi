import type { NextConfig } from "next";

/**
 * A static export: no server, no route handlers. Every network call goes to the relay on the same
 * origin: OHTTP messages to the gateway, and pictures through the image proxy. Headers (a CSP with
 * each page's inline-script hashes, COOP/COEP) are written by scripts/headers.mjs after the build.
 */
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  // Dev only: lets a fresh origin (empty IndexedDB) load the app, to see first-run screens without touching the dev wallet.
  allowedDevOrigins: ["127.0.0.1"],
  images: { unoptimized: true },
  transpilePackages: [
    "@mitoshi/zwallet",
    "@mitoshi/net",
    "@mitoshi/engine",
    "@mitoshi/rails",
    "@mitoshi/venues",
    "@mitoshi/chart",
  ],
  output: "export",
  // A second dev server (mainnet, port 3301) needs its own build folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default config;
