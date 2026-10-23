/** The lightwalletd gRPC service name (cash.z.wallet.sdk.rpc). */
export const LWD_SERVICE = "cash.z.wallet.sdk.rpc.CompactTxStreamer";

/**
 * The light servers the gateway calls for the wallet (every call goes over OHTTP, so these hosts
 * only ever see the gateway). Interim: ChainSafe's public gRPC-web proxies.
 */
export const LWD_UPSTREAM = {
  main: "https://zcash-mainnet.chainsafe.dev",
  test: "https://zcash-testnet.chainsafe.dev",
} as const;

/** Blocks fetched and scanned per batch. Small enough to keep the UI's progress smooth. */
export const SCAN_BATCH_BLOCKS = 100;

/** Chain reorgs the sync loop rewinds through before it gives up (each one rewinds 10 blocks). */
export const MAX_REORG_REWINDS = 5;

/** A new wallet's birthday is this many blocks below the tip, so it never misses its first deposit. */
export const BIRTHDAY_LOOKBACK_BLOCKS = 20;

/** Shielded protocol numbers in lightwalletd's GetSubtreeRoots. */
export const SUBTREE_PROTOCOLS = [
  { name: "sapling", id: 0 },
  { name: "orchard", id: 1 },
  { name: "ironwood", id: 2 },
] as const;

/** Where the wallet file lives inside the WASI file system (matches the Rust core's DB_PATH). */
export const WASI_DATA_DIR = "/data";
export const WALLET_FILE = "wallet.sqlite";

/** BIP 39 strength for new wallets: 256 bits = 24 words. */
export const MNEMONIC_STRENGTH_BITS = 256;

/** Zatoshis per ZEC. */
export const ZAT_PER_ZEC = 100_000_000;

/**
 * Confirmations before a received note can be spent: zcash_client_backend's ConfirmationsPolicy::default()
 * (data_api/wallet.rs), 10 for notes from others and 3 for this wallet's own change. The core uses that policy.
 */
export const RECEIVED_CONFIRMATIONS = 10;

/** Zcash's target block spacing since Blossom (ZIP 208), in seconds. */
export const BLOCK_SECONDS = 75;

/** The worker reports the engine download at most once per this many bytes (256 KiB). */
export const LOAD_REPORT_BYTES = 262_144;
