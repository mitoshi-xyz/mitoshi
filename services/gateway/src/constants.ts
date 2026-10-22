/** Polymarket's geoblock check (on polymarket.com, not the API hosts). */
export const POLYMARKET_GEOBLOCK = "https://polymarket.com/api/geoblock";

/**
 * gRPC-web lightwalletd upstreams. Interim: ChainSafe's public gRPC-web proxies. They see only the
 * gateway's address, never a user's. They get replaced by Mitoshi's own proxy on Coolify.
 */
export const LWD_UPSTREAM: Record<string, string> = {
  main: "https://zcash-mainnet.chainsafe.dev",
  test: "https://zcash-testnet.chainsafe.dev",
};

/** The only lightwalletd methods the wallet uses. */
export const LWD_METHODS = new Set([
  "GetLatestBlock",
  "GetTreeState",
  "GetSubtreeRoots",
  "GetBlockRange",
  "SendTransaction",
]);

export const LWD_SERVICE = "cash.z.wallet.sdk.rpc.CompactTxStreamer";

/** Request bodies above this are refused (a raw transaction is ~10 KB). */
export const MAX_BODY_BYTES = 256 * 1024;

/** Browser origins allowed to call the gateway. */
export const ALLOWED_ORIGINS = new Set(["http://localhost:3300", "https://mitoshi.xyz", "https://www.mitoshi.xyz"]);
