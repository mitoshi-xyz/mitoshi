/**
 * Writes out/_headers for the mitoshi-web Worker after `next build`.
 *
 * Every page gets a Content-Security-Policy that allows its own inline scripts by SHA-256 hash and
 * nothing else inline, so there is no 'unsafe-inline' for scripts. Every response gets cross-origin
 * isolation (COOP/COEP/CORP), the usual hardening headers, and no-transform, so nothing is added on the way.
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
  // no-transform: Cloudflare's proxy may not rewrite a page, so it cannot inject its analytics beacon (on by default for
  // a proxied zone) or an email-obfuscation script. The rest is the assets default: every load revalidates.
  "Cache-Control": "public, max-age=0, must-revalidate, no-transform",
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
// /_next/static/* caching is set by the Worker (services/web), which marks only real files immutable: a rule here would
// also make a missing chunk's 404 immutable, and a browser that loads mid-deploy would keep it for a year.

/**
 * Pages that play a video from another origin (features/landing/demo-player.tsx): they may frame that origin, and they
 * drop COEP, which a player that sends no CORP or COEP of its own cannot load under. Nothing on them uses shared memory
 * (the wallet core refuses to run on it), so only these pages lose cross-origin isolation.
 */
const EMBEDS = { "/demo": "https://www.youtube-nocookie.com" };

const policyFor = (html, base) =>
  [...base, `script-src 'self' 'wasm-unsafe-eval' ${scriptHashes(html).join(" ")}`.trim()].join("; ");
// A <meta> policy cannot carry frame-ancestors (browsers ignore it there); X-Frame-Options covers framing.
const META_POLICY = BASE_POLICY.filter((d) => !d.startsWith("frame-ancestors"));

let pages = 0;
for (const file of htmlFiles(OUT)) {
  const paths = routes(file);
  const html = readFileSync(file, "utf8");
  if (paths.length === 0) {
    // The 404 page answers every unknown path, so no _headers rule names it: it carries its own policy, ahead of
    // every script. Adding a tag leaves the inline scripts, and so their hashes, unchanged.
    const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(html, META_POLICY)}"/>`;
    if (!html.includes("<head>")) throw new Error(`${file}: no <head> to put the policy in`);
    if (!html.includes('http-equiv="Content-Security-Policy"'))
      writeFileSync(file, html.replace("<head>", `<head>${meta}`));
    continue;
  }
  for (const p of paths) {
    const embed = EMBEDS[p];
    const policy = policyFor(html, embed ? [...BASE_POLICY, `frame-src ${embed}`] : BASE_POLICY);
    const line = `  Content-Security-Policy: ${policy}`;
    if (line.length > MAX_LINE) throw new Error(`${file}: CSP line is ${line.length} characters (limit ${MAX_LINE})`);
    lines.push(p, line, ...(embed ? ["  ! Cross-Origin-Embedder-Policy"] : []), "");
  }
  pages++;
}

writeFileSync(join(OUT, "_headers"), lines.join("\n"));
console.log(`_headers: ${pages} pages with script hashes`);
