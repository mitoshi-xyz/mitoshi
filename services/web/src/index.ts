import {
  CANONICAL_HOST,
  DEV_ORIGINS,
  IMAGE_CACHE_SECONDS,
  MAX_RELAY_BODY_BYTES,
  PASS_BACK,
  RELAY_PREFIX,
  STATIC_CACHE,
  STATIC_PREFIX,
  WORKER_CSP,
  WWW_HOST,
} from "./constants";

import { PROTOCOLS } from "./live";

export { LiveFeed } from "./live";

interface Env {
  ASSETS: Fetcher;
  LIVE: DurableObjectNamespace;
  GATEWAY_URL: string;
  RELAY_TOKEN?: string;
}

const HTTP_OK = 200;
const HTTP_MOVED = 301;
const HTTP_NO_CONTENT = 204;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_TOO_LARGE = 413;

type Route = { gateway: string; method: "GET" | "POST"; contentType?: string; cacheable?: boolean };

/**
 * What the relay forwards: OHTTP messages (ciphertext to the relay) and images (the same for every
 * user). Nothing else from the browser is passed on: no IP, cookies, user agent, referrer or
 * language; the gateway sees only this Worker.
 */
function route(path: string): Route | null {
  if (path === "/ohttp") return { gateway: "/ohttp", method: "POST", contentType: "message/ohttp-req" };
  if (path === "/img") return { gateway: "/img", method: "GET", cacheable: true };
  return null;
}

function cors(request: Request, headers: Headers) {
  const origin = request.headers.get("origin");
  if (!origin || !DEV_ORIGINS.has(origin)) return;
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("vary", "origin");
}

async function relay(request: Request, env: Env, path: string, search: string): Promise<Response> {
  const r = route(path);
  if (!r) return new Response("not found", { status: HTTP_NOT_FOUND });
  if (request.method !== r.method) return new Response("method not allowed", { status: HTTP_METHOD_NOT_ALLOWED });
  const headers = new Headers();
  if (r.contentType) headers.set("content-type", r.contentType);
  if (env.RELAY_TOKEN) headers.set("x-mitoshi-relay", env.RELAY_TOKEN);
  let body: ArrayBuffer | null = null;
  if (r.method === "POST") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_RELAY_BODY_BYTES) return new Response("too large", { status: HTTP_TOO_LARGE });
  }
  const res = await fetch(`${env.GATEWAY_URL}${r.gateway}${r.method === "GET" ? search : ""}`, {
    method: r.method,
    headers,
    body,
    cf: r.cacheable ? { cacheTtl: IMAGE_CACHE_SECONDS, cacheEverything: true } : { cacheTtl: 0 },
  });
  const out = new Headers();
  for (const h of PASS_BACK) {
    const v = res.headers.get(h);
    if (v !== null) out.set(h, v);
  }
  if (r.cacheable && res.ok) out.set("cache-control", `public, max-age=${IMAGE_CACHE_SECONDS}`);
  // Pictures are public and may be shown from the dev origins too; everything else stays same-origin.
  out.set("cross-origin-resource-policy", r.cacheable ? "cross-origin" : "same-origin");
  out.set("referrer-policy", "no-referrer");
  cors(request, out);
  return new Response(res.body, { status: res.status, headers: out });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // The zone's redirect rule answers www first; this covers the relay if that rule is ever lost.
    if (url.hostname === WWW_HOST) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), HTTP_MOVED);
    }
    const feed = url.pathname.startsWith(`${RELAY_PREFIX}/live/`) ? url.pathname.split("/").pop() : undefined;
    if (feed !== undefined) {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin && !DEV_ORIGINS.has(origin)) {
        return new Response("forbidden", { status: HTTP_FORBIDDEN });
      }
      if (!PROTOCOLS[feed]) return new Response("unknown feed", { status: HTTP_NOT_FOUND });
      return env.LIVE.get(env.LIVE.idFromName(feed), { locationHint: "weur" }).fetch(request);
    }
    if (url.pathname.startsWith(`${RELAY_PREFIX}/`)) {
      if (request.method === "OPTIONS") {
        const h = new Headers();
        cors(request, h);
        return new Response(null, { status: HTTP_NO_CONTENT, headers: h });
      }
      return relay(request, env, url.pathname.slice(RELAY_PREFIX.length), url.search);
    }
    if (url.pathname.startsWith(STATIC_PREFIX)) {
      // Only a file that exists is cached for good; a miss (a chunk from another deploy) is never cached.
      const res = await env.ASSETS.fetch(request);
      const out = new Response(res.body, res);
      out.headers.set("cache-control", res.status === HTTP_OK ? STATIC_CACHE : "no-store");
      out.headers.set("content-security-policy", WORKER_CSP);
      return out;
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
