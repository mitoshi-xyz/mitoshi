import { BUILDER_RELAYER_PATHS, BUILDER_SUBMIT_TYPES, DEPOSIT_WALLET_FACTORY } from "./constants";

/**
 * Polymarket's Remote Builder Signing (docs.polymarket.com/trading/wallets-auth, "Remote Builder
 * Signing"): the browser's SDK asks for the builder headers of one relayer request, and only the
 * gateway holds the Builder API secret. It reaches here over OHTTP like everything else, so it
 * sees which signer is asking but never who.
 *
 * It signs relayer requests for Deposit Wallets only (create one, or run one batch through the
 * wallet factory), so the builder's relayer quota can't be used for anything else.
 */

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_UNAVAILABLE = 503;
const MS_PER_SECOND = 1000;

export interface BuilderCredentials {
  key: string;
  secret: string;
  passphrase: string;
}

const fromB64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const toB64Url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

/** HMAC-SHA256 over timestamp + method + path + body, keyed by the base64 secret, url-safe base64 out. */
async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", fromB64Url(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return toB64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

function allowed(method: string, path: string, body: string): string | null {
  if (method !== "GET" && method !== "POST") return "method";
  if (!BUILDER_RELAYER_PATHS.some((p) => path === p || path.startsWith(`${p}?`) || path.startsWith(`${p}/`)))
    return "path";
  if (path !== "/submit") return null;
  try {
    const req = JSON.parse(body) as { type?: unknown; to?: unknown };
    if (typeof req.type !== "string" || !BUILDER_SUBMIT_TYPES.includes(req.type)) return "relayer request type";
    if (typeof req.to !== "string" || req.to.toLowerCase() !== DEPOSIT_WALLET_FACTORY.toLowerCase()) return "target";
    return null;
  } catch {
    return "body";
  }
}

/** `POST https://builder.mitoshi.internal/sign` (inside OHTTP): `{method, path, body}` → the four builder headers. */
export async function builderSign(inner: Request, creds: BuilderCredentials | null): Promise<Response> {
  if (!creds)
    return Response.json(
      { error: "Polymarket builder credentials are not set on the gateway" },
      { status: HTTP_UNAVAILABLE },
    );
  let ask: { method?: unknown; path?: unknown; body?: unknown };
  try {
    ask = (await inner.json()) as typeof ask;
  } catch {
    return Response.json({ error: "expected JSON" }, { status: HTTP_BAD_REQUEST });
  }
  const method = typeof ask.method === "string" ? ask.method.toUpperCase() : "";
  const path = typeof ask.path === "string" ? ask.path : "";
  const body =
    typeof ask.body === "string"
      ? ask.body
      : ask.body === undefined || ask.body === null
        ? ""
        : JSON.stringify(ask.body);
  const refused = allowed(method, path, body);
  if (refused) return Response.json({ error: `not signed: ${refused}` }, { status: HTTP_FORBIDDEN });
  const timestamp = Math.floor(Date.now() / MS_PER_SECOND);
  return Response.json({
    POLY_BUILDER_API_KEY: creds.key,
    POLY_BUILDER_PASSPHRASE: creds.passphrase,
    POLY_BUILDER_SIGNATURE: await hmac(creds.secret, `${timestamp}${method}${path}${body}`),
    POLY_BUILDER_TIMESTAMP: `${timestamp}`,
  });
}
