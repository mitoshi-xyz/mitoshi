/** The lightwalletd gRPC service name (cash.z.wallet.sdk.rpc). */
export const LWD_SERVICE = "cash.z.wallet.sdk.rpc.CompactTxStreamer";

/** Blocks fetched and scanned per batch. Small enough to keep the UI's progress smooth. */
export const SCAN_BATCH_BLOCKS = 100;

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
