/**
 * Writes out/_headers for the mitoshi-web Worker after `next build`.
 *
 * Every page gets a Content-Security-Policy that allows its own inline scripts by SHA-256 hash and
 * nothing else inline, so there is no 'unsafe-inline' for scripts. Every response gets cross-origin
 * isolation (COOP/COEP/CORP) and the usual hardening headers.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

// The export lands in out/, or in the build folder itself when NEXT_DIST_DIR names one (next.config.ts).
const OUT = new URL(`../${process.env.NEXT_DIST_DIR ?? "out"}/`, import.meta.url).pathname;
const MAX_LINE = 2000;

const BASE_POLICY = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
];

const EVERYWHERE = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
};

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith(".html") ? [path] : [];
  });
}

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

function scriptHashes(html) {
  const hashes = new Set();
  for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
    if (body.length > 0) hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return [...hashes];
}

/** URL paths a file is served at (html_handling "auto-trailing-slash": /wallet serves wallet.html). */
function routes(file) {
  const rel = relative(OUT, file).split(sep).join("/");
  if (rel === "404.html" || rel === "_not-found.html") return [];
  if (rel === "index.html") return ["/"];
  if (rel.endsWith("/index.html")) return [`/${rel.slice(0, -"index.html".length)}`];
  return [`/${rel.slice(0, -".html".length)}`];
}

const lines = ["/*", ...Object.entries(EVERYWHERE).map(([k, v]) => `  ${k}: ${v}`), ""];
lines.push("/_next/static/*", "  Cache-Control: public, max-age=31536000, immutable", "");

let pages = 0;
for (const file of htmlFiles(OUT)) {
  const paths = routes(file);
  if (paths.length === 0) continue;
  const hashes = scriptHashes(readFileSync(file, "utf8"));
  const policy = [...BASE_POLICY, `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`.trim()].join("; ");
  const line = `  Content-Security-Policy: ${policy}`;
  if (line.length > MAX_LINE) throw new Error(`${file}: CSP line is ${line.length} characters (limit ${MAX_LINE})`);
  for (const p of paths) lines.push(p, line, "");
  pages++;
}

writeFileSync(join(OUT, "_headers"), lines.join("\n"));
console.log(`_headers: ${pages} pages with script hashes`);
