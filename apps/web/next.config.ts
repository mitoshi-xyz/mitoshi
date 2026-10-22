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
  images: { unoptimized: true },
  transpilePackages: ["@mitoshi/zwallet", "@mitoshi/net"],
  output: "export",
};

export default config;
