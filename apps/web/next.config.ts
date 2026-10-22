import type { NextConfig } from "next";

/**
 * A static export: no server, no route handlers. Every network call goes through
 * the Mitoshi gateway (user calls over OHTTP, public data through the caching proxy).
 */
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
  transpilePackages: ["@mitoshi/zwallet"],
  output: "export",
};

export default config;
