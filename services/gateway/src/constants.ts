/**
 * The gateway runs on Vercel in Dublin (dub1, AWS eu-west-1). Polymarket names eu-west-1 its
 * "Closest Non-Georestricted Region", and Ireland is close-only on its frontend only, not on the API
 * (docs.polymarket.com/api-reference/geoblock). It is not on Cloudflare on purpose: a Cloudflare
 * Worker passes the visitor's own country on to every Cloudflare-hosted site it calls, even from a
 * Durable Object (tested 2026-10-22), and Polymarket, NEAR's 1Click and Jupiter sit behind Cloudflare.
 */

/** Polymarket's geoblock check (on polymarket.com, not the API hosts). */
export const POLYMARKET_GEOBLOCK = "https://polymarket.com/api/geoblock";

export const LWD_SERVICE = "cash.z.wallet.sdk.rpc.CompactTxStreamer";

/**
 * The only lightwalletd methods the wallet uses. All of them go over OHTTP: even block ranges say
 * something about one wallet (where its scan starts is its birthday).
 */
export const LWD_METHODS = [
  "GetLatestBlock",
  "GetTreeState",
  "GetSubtreeRoots",
  "GetBlockRange",
  "GetTransaction",
  "SendTransaction",
];

export interface Upstream {
  /** Path prefixes a request may use. */
  paths: readonly string[];
  methods: readonly ("GET" | "POST" | "DELETE")[];
  /** Request headers passed through, beyond content-type and accept. */
  headers?: readonly string[];
  /** Seconds a GET response may be shared between users (public data only). */
  cacheSeconds?: number;
  /**
   * A header the gateway adds from one of its own secrets (a partner key the browser never sees).
   * It is the same for every user, so it ties no two requests to one person.
   */
  inject?: { header: string; secret: "ONECLICK_API_KEY" };
  /**
   * POST bodies whose JSON `type` is public market data, with how many seconds a response may be
   * shared between users. Anything that names a user is never in this list.
   */
  cachePostTypes?: Record<string, number>;
  /** GET path prefixes that may be shared, with seconds (overrides `cacheSeconds`). */
  cacheGetPaths?: Record<string, number>;
  /** For JSON-RPC upstreams: the only methods a request may call. */
  rpcMethods?: readonly string[];
}

const GET_POST = ["GET", "POST"] as const;
const POST = ["POST"] as const;
/** Interim light servers: ChainSafe's public gRPC-web proxies. They only ever see the gateway. */
const LWD: Upstream = {
  paths: LWD_METHODS.map((m) => `/${LWD_SERVICE}/${m}`),
  methods: POST,
  headers: ["x-grpc-web"],
};

/**
 * Every host the gateway will call for a user, and how. Anything else is refused. Hosts are added
 * stage by stage, each checked against the venue's docs first.
 */
export const UPSTREAMS: Record<string, Upstream> = {
  // Zcash light servers.
  "zcash-mainnet.chainsafe.dev": LWD,
  "zcash-testnet.chainsafe.dev": LWD,
  // NEAR Intents 1Click (docs.near-intents.org): tokens, quote, deposit submit, status.
  // Hyperliquid (hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api): info and signed actions.
  "api.hyperliquid.xyz": {
    paths: ["/info", "/exchange"],
    methods: POST,
    cachePostTypes: {
      meta: 60,
      spotMeta: 60,
      metaAndAssetCtxs: 2,
      spotMetaAndAssetCtxs: 2,
      allMids: 1,
      l2Book: 1,
      recentTrades: 2,
      candleSnapshot: 2,
      fundingHistory: 60,
      predictedFundings: 30,
    },
  },
  // Polymarket public data (docs.polymarket.com): events, tags and search on Gamma.
  "gamma-api.polymarket.com": {
    paths: ["/events", "/tags", "/public-search", "/markets"],
    methods: ["GET"],
    cacheSeconds: 30,
  },
  // Polymarket CLOB reads: price history and order books (trading routes are added with S4 trading).
  "clob.polymarket.com": {
    paths: ["/prices-history", "/book", "/books", "/midpoint", "/price", "/spread"],
    methods: ["GET"],
    cacheSeconds: 2,
  },
  // Jupiter (keyless lite tier): Ultra swaps for each wallet, token lists and prices for everyone.
  "lite-api.jup.ag": {
    paths: ["/ultra/v1/order", "/ultra/v1/execute", "/ultra/v1/holdings/", "/tokens/v2/", "/price/v3"],
    methods: GET_POST,
    cacheGetPaths: { "/tokens/v2/": 30, "/price/v3": 5 },
  },
  // GeckoTerminal: Solana pools and OHLCV candles.
  "api.geckoterminal.com": { paths: ["/api/v2/networks/solana/"], methods: ["GET"], cacheSeconds: 30 },
  // Solana RPC: balances, the one transfer home, and a wallet's public transaction list (the copy-trader's view).
  "api.mainnet-beta.solana.com": {
    paths: ["/"],
    methods: POST,
    rpcMethods: [
      "getBalance",
      "getLatestBlockhash",
      "sendTransaction",
      "getSignatureStatuses",
      "simulateTransaction",
      "getSignaturesForAddress",
    ],
  },
  "1click.chaindefuser.com": {
    paths: ["/v0/tokens", "/v0/quote", "/v0/deposit/submit", "/v0/status"],
    methods: GET_POST,
    inject: { header: "x-api-key", secret: "ONECLICK_API_KEY" },
  },
};

/** Request headers that are always dropped, whatever the upstream. */
export const NEVER_FORWARD = ["cookie", "origin", "referer", "user-agent", "x-forwarded-for", "forwarded"];

/**
 * Sent as the user agent on every upstream call, the same for everyone. It reads as a browser
 * because 1Click's Cloudflare rules refuse bare runtime agents (error 1010).
 */
export const UPSTREAM_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

/** Response headers passed back to the browser; everything else (set-cookie, server ids) is dropped. */
export const RESPONSE_HEADERS = ["content-type", "retry-after", "grpc-status", "grpc-message"];

/** The largest decrypted request or response the OHTTP layer handles (Polymarket lists can be big). */
export const OHTTP_MAX_MESSAGE_BYTES = 8 * 1024 * 1024;

/** The key id published in the gateway's key configuration. */
export const OHTTP_KEY_ID = 1;

/** Seed length for the deterministic OHTTP key pair. */
export const OHTTP_SEED_BYTES = 32;

/** Images: only these types, at most this size, cached for a day. */
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml"];
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_CACHE_SECONDS = 86_400;

/** Entries kept in each instance's in-memory cache of public responses. */
export const PUBLIC_CACHE_ENTRIES = 500;

/** How long an upstream call may take before the gateway gives up. */
export const UPSTREAM_TIMEOUT_MS = 30_000;

export const MS_PER_SECOND = 1000;
