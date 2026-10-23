import { createMDX } from "fumadocs-mdx/next";

/**
 * A static export served at the root of docs.mitoshi.xyz: no server, no route handlers at runtime (the search index is
 * written as a file at build time). Headers, including a CSP with each page's inline-script hashes, come from
 * scripts/headers.mjs after the build.
 * @type {import('next').NextConfig}
 */
const config = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
};

const withMDX = createMDX();

export default withMDX(config);
