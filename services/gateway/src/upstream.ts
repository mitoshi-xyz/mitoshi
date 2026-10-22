import {
  MS_PER_SECOND,
  NEVER_FORWARD,
  PUBLIC_CACHE_ENTRIES,
  RESPONSE_HEADERS,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_USER_AGENT,
  UPSTREAMS,
  type Upstream,
} from "./constants";

const HTTP_FORBIDDEN = 403;
const HTTP_BAD_GATEWAY = 502;

interface Cached {
  expires: number;
  status: number;
  headers: [string, string][];
  body: ArrayBuffer;
}

/** Public responses shared between users, per instance. Keyed by URL only (GETs with no auth). */
const cache = new Map<string, Cached>();

function remember(key: string, entry: Cached) {
  if (cache.size >= PUBLIC_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
}

function refuse(reason: string, status = HTTP_FORBIDDEN): Response {
  return Response.json({ error: reason }, { status });
}

/** The upstream rule for a URL, or null when the gateway must not call it. */
export function ruleFor(url: URL, method: string): Upstream | null {
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") return null;
  const rule = UPSTREAMS[url.hostname];
  if (!rule) return null;
  if (!(rule.methods as readonly string[]).includes(method)) return null;
  if (!rule.paths.some((p) => url.pathname.startsWith(p))) return null;
  return rule;
}

function upstreamHeaders(inner: Headers, rule: Upstream): Headers {
  const out = new Headers({ "user-agent": UPSTREAM_USER_AGENT });
  const allowed = new Set(["content-type", "accept", ...(rule.headers ?? [])]);
  for (const [name, value] of inner) {
    const n = name.toLowerCase();
    if (allowed.has(n) && !NEVER_FORWARD.includes(n)) out.set(n, value);
  }
  return out;
}

function filtered(res: Response): Headers {
  const out = new Headers({ "cache-control": "no-store" });
  for (const name of RESPONSE_HEADERS) {
    const v = res.headers.get(name);
    if (v !== null) out.set(name, v);
  }
  return out;
}

/** Gateway-held secrets an upstream rule may inject. */
export type Secrets = Partial<Record<NonNullable<Upstream["inject"]>["secret"], string>>;

/**
 * Calls an allowlisted upstream for a decrypted user request. Only the method, URL, body and a
 * fixed set of headers go out; the response comes back with only its status, body and type.
 */
export async function forward(inner: Request, secrets: Secrets = {}): Promise<Response> {
  const url = new URL(inner.url);
  const method = inner.method.toUpperCase();
  const rule = ruleFor(url, method);
  if (!rule) return refuse(`not allowed: ${method} ${url.hostname}${url.pathname}`);

  const headers = upstreamHeaders(inner.headers, rule);
  const injected = rule.inject ? secrets[rule.inject.secret] : undefined;
  if (rule.inject && injected) headers.set(rule.inject.header, injected);
  const shareable = method === "GET" && rule.cacheSeconds !== undefined && !headers.has("authorization");
  const key = url.toString();
  if (shareable) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      return new Response(hit.body, { status: hit.status, headers: hit.headers });
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? null : await inner.arrayBuffer(),
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    return refuse(`upstream unreachable: ${url.hostname} (${e instanceof Error ? e.name : "error"})`, HTTP_BAD_GATEWAY);
  }
  const body = await res.arrayBuffer();
  const out = filtered(res);
  if (shareable && res.ok && rule.cacheSeconds !== undefined) {
    remember(key, {
      expires: Date.now() + rule.cacheSeconds * MS_PER_SECOND,
      status: res.status,
      headers: [...out],
      body,
    });
  }
  return new Response(body, { status: res.status, headers: out });
}
