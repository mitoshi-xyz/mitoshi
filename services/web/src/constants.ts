/** Paths under /relay and the gateway route each one goes to. */
export const RELAY_PREFIX = "/relay";

/** Browser origins (besides this Worker's own) allowed to use the relay: local development only (3300 testnet, 3301 mainnet). */
export const DEV_ORIGINS = new Set(["http://localhost:3300", "http://localhost:3301"]);

/** Largest body the relay will pass on (OHTTP messages are capped at 8 MiB by the gateway). */
export const MAX_RELAY_BODY_BYTES = 8 * 1024 * 1024 + 64 * 1024;

/** Response headers passed back to the browser from the gateway. */
export const PASS_BACK = ["content-type", "cache-control", "content-security-policy", "x-content-type-options"];

/** The one address the app answers at; www redirects there. */
export const CANONICAL_HOST = "mitoshi.xyz";
export const WWW_HOST = "www.mitoshi.xyz";

/** Build files are named by their content, so a found one never changes. */
export const STATIC_PREFIX = "/_next/static/";
/**
 * The policy every /_next/static file is served with. Browsers apply it only where a script runs as a worker (a module
 * worker takes its CSP from its own response, not from the page), so the wallet and Polymarket workers can reach this
 * origin and nothing else, even if a library inside them reaches past the OHTTP fetch.
 */
export const WORKER_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'";
export const STATIC_CACHE = "public, max-age=31536000, immutable";

/** Images are shared by everyone, so the relay may cache them. */
export const IMAGE_CACHE_SECONDS = 86_400;

/** The documentation site, and where each old in-app /docs page now lives on it. */
export const DOCS_ORIGIN = "https://docs.mitoshi.xyz";
export const DOCS_PREFIX = "/docs";
export const DOCS_MOVED: Record<string, string> = {
  "": "/",
  "/how-it-works": "/docs/guide/private-wallets",
  "/privacy": "/docs/privacy",
  "/venues": "/docs/venues",
  "/fees": "/docs/guide/fees-and-timing",
  "/recovery": "/docs/guide/backup-and-recovery",
  "/architecture": "/docs/build/architecture",
};
