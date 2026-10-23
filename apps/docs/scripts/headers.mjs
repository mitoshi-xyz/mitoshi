/**
 * Runs after `next build`: writes out/_headers for the mitoshi-docs Worker (Workers static assets read it).
 *
 * Every page gets a Content-Security-Policy that allows its own inline scripts by SHA-256 hash and nothing else inline:
 * no 'unsafe-inline' for scripts, nothing from another origin. Every response gets the usual hardening headers and
 * no-transform, so Cloudflare's proxy cannot add a script (its analytics beacon, email obfuscation) on the way.
 * The 404 page answers every unknown path, so no rule can name it: it carries its policy in a meta tag instead.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../out/", import.meta.url));
/** Cloudflare reads _headers lines up to 2,000 characters. */
const MAX_LINE = 2000;
const NOT_FOUND = new Set(["404.html", "_not-found.html"]);

const BASE_POLICY = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
];
// A <meta> policy cannot carry frame-ancestors (browsers ignore it there); X-Frame-Options covers framing.
const META_POLICY = BASE_POLICY.filter((d) => !d.startsWith("frame-ancestors"));

const EVERYWHERE = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
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

const policyFor = (html, base) => [...base, `script-src 'self' ${scriptHashes(html).join(" ")}`.trim()].join("; ");

/** The URL a page is served at (html_handling "auto-trailing-slash": /privacy serves privacy.html). */
function route(rel) {
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel.slice(0, -".html".length)}`;
}

const lines = ["/*", ...Object.entries(EVERYWHERE).map(([k, v]) => `  ${k}: ${v}`), ""];
let pages = 0;
let longest = 0;
for (const file of htmlFiles(OUT)) {
  const rel = relative(OUT, file).split(sep).join("/");
  const html = readFileSync(file, "utf8");
  if (NOT_FOUND.has(rel)) {
    if (html.includes('http-equiv="Content-Security-Policy"')) continue;
    if (!html.includes("<head>")) throw new Error(`${rel}: no <head> to put the policy in`);
    // Adding a tag ahead of every script leaves the inline scripts, and so their hashes, unchanged.
    const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(html, META_POLICY)}"/>`;
    writeFileSync(file, html.replace("<head>", `<head>${meta}`));
    continue;
  }
  const line = `  Content-Security-Policy: ${policyFor(html, BASE_POLICY)}`;
  if (line.length > MAX_LINE) throw new Error(`${rel}: CSP line is ${line.length} characters (limit ${MAX_LINE})`);
  longest = Math.max(longest, line.length);
  lines.push(route(rel), line, "");
  pages++;
}

writeFileSync(join(OUT, "_headers"), lines.join("\n"));
console.log(`_headers: ${pages} pages with script hashes (longest CSP line ${longest} of ${MAX_LINE} characters)`);
