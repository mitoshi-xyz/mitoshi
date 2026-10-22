import { POLYMARKET_GEOBLOCK } from "./constants";
import { img } from "./img";
import { ohttp, ohttpKeys } from "./ohttp";

const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;

export interface Env {
  /** 32-byte hex seed for the OHTTP key pair. */
  OHTTP_SEED?: string;
  /** Shared with the relay so the gateway is not an open proxy for anyone else. */
  RELAY_TOKEN?: string;
  /** NEAR Intents partner key (partners.near-intents.org): lower 1Click fees, confidential swaps. */
  ONECLICK_API_KEY?: string;
  /** Polymarket Builder API credentials (polymarket.com → Settings → Builders), for gasless Deposit Wallets. */
  POLYMARKET_BUILDER_API_KEY?: string;
  POLYMARKET_BUILDER_SECRET?: string;
  POLYMARKET_BUILDER_PASSPHRASE?: string;
}

/** `GET /v1/geo`: what Polymarket sees of the gateway's egress. Never echoes the IP. */
async function geo(): Promise<Response> {
  const res = await fetch(POLYMARKET_GEOBLOCK, { headers: { accept: "application/json" } });
  if (!res.ok) return Response.json({ error: `geoblock check failed: ${res.status}` }, { status: HTTP_BAD_GATEWAY });
  const g = (await res.json()) as { blocked: boolean; country: string; region: string };
  return Response.json({ frontendBlocked: g.blocked, country: g.country, region: g.region });
}

/** The gateway: every route the relay forwards to. */
export async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const [head, ...rest] = url.pathname.split("/").filter(Boolean);
  if (head === "ohttp-keys") return ohttpKeys(env.OHTTP_SEED);
  if (head === "v1" && rest[0] === "geo") return geo();
  if (env.RELAY_TOKEN && request.headers.get("x-mitoshi-relay") !== env.RELAY_TOKEN) {
    return new Response("relay only", { status: HTTP_UNAUTHORIZED });
  }
  if (head === "ohttp") {
    const secrets = env.ONECLICK_API_KEY ? { ONECLICK_API_KEY: env.ONECLICK_API_KEY } : {};
    const builder =
      env.POLYMARKET_BUILDER_API_KEY && env.POLYMARKET_BUILDER_SECRET && env.POLYMARKET_BUILDER_PASSPHRASE
        ? {
            key: env.POLYMARKET_BUILDER_API_KEY,
            secret: env.POLYMARKET_BUILDER_SECRET,
            passphrase: env.POLYMARKET_BUILDER_PASSPHRASE,
          }
        : null;
    return ohttp(request, env.OHTTP_SEED, secrets, builder);
  }
  if (head === "img") return img(request);
  return new Response("not found", { status: HTTP_NOT_FOUND });
}
