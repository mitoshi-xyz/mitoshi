import {
  IMAGE_CACHE_SECONDS,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  UPSTREAM_TIMEOUT_MS,
  UPSTREAM_USER_AGENT,
} from "./constants";

const HTTP_BAD_REQUEST = 400;
const HTTP_BAD_GATEWAY = 502;
const HTTP_TOO_LARGE = 413;
const MAX_REDIRECTS = 3;
const HTTP_REDIRECT_MIN = 300;
const HTTP_REDIRECT_MAX = 399;

/** Hostnames that must never be fetched: local names and literal IP addresses. */
function privateHost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    host.startsWith("[")
  );
}

function allowed(url: URL): boolean {
  return url.protocol === "https:" && !url.username && !url.password && url.port === "" && !privateHost(url.hostname);
}

/** Fetches an image, following at most a few redirects and checking every hop (no SSRF via redirect). */
async function fetchImage(start: URL): Promise<Response | null> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      headers: { "user-agent": UPSTREAM_USER_AGENT, accept: "image/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    if (!location || res.status < HTTP_REDIRECT_MIN || res.status > HTTP_REDIRECT_MAX) return res;
    url = new URL(location, url);
    if (!allowed(url)) return null;
  }
  return null;
}

/**
 * `GET /img?u=<https url>`: market, coin and token pictures, fetched here so the image hosts never
 * see a user's IP, and served with CORP so the app can stay cross-origin isolated. The response is
 * sandboxed: opened directly, an SVG cannot run script on the app's origin.
 */
export async function img(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get("u");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("bad image url", { status: HTTP_BAD_REQUEST });
  }
  if (!allowed(target)) return new Response("image host not allowed", { status: HTTP_BAD_REQUEST });
  let res: Response | null;
  try {
    res = await fetchImage(target);
  } catch {
    return new Response("image unreachable", { status: HTTP_BAD_GATEWAY });
  }
  if (!res) return new Response("image redirect not allowed", { status: HTTP_BAD_REQUEST });
  const type = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!res.ok || !IMAGE_TYPES.includes(type)) return new Response("not an image", { status: HTTP_BAD_GATEWAY });
  const body = await res.arrayBuffer();
  if (body.byteLength > IMAGE_MAX_BYTES) return new Response("image too large", { status: HTTP_TOO_LARGE });
  return new Response(body, {
    headers: {
      "content-type": type,
      "cache-control": `public, max-age=${IMAGE_CACHE_SECONDS}, s-maxage=${IMAGE_CACHE_SECONDS}`,
      "cross-origin-resource-policy": "cross-origin",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
