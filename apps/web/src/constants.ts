/**
 * The OHTTP relay (same origin in production). Every call the app makes goes to it: OHTTP messages
 * it cannot read, and pictures through its image proxy. Development points at the deployed relay.
 */
export const RELAY =
  process.env.NEXT_PUBLIC_RELAY ?? (process.env.NODE_ENV === "development" ? "https://mitoshi.xyz/relay" : "/relay");

/**
 * Zcash network the app runs on. A production build is mainnet and development is testnet, unless
 * NEXT_PUBLIC_ZEC_NETWORK says otherwise (`dev:main` runs mainnet locally).
 */
export const ZEC_NETWORK: "main" | "test" =
  (process.env.NEXT_PUBLIC_ZEC_NETWORK ?? (process.env.NODE_ENV === "production" ? "main" : "test")) === "main"
    ? "main"
    : "test";

/** How often an open wallet checks for new blocks. */
export const WALLET_SYNC_INTERVAL_MS = 30_000;

/** Ironwood (NU6.3) activation: restored wallets scan from here, since every newer shielded note lives in Ironwood. */
export const IRONWOOD_ACTIVATION = { main: 3_428_143, test: 4_134_000 } as const;

export const VAULT_DB = { name: "mitoshi-vault", version: 1, keys: "keys", records: "records" } as const;
export const VAULT_KEY_BITS = 256;
export const VAULT_IV_BYTES = 12;
/** The passphrase lock: PBKDF2-SHA-256 at OWASP's 2023 count, with a 16-byte salt. */
export const LOCK_PBKDF2_ITERATIONS = 600_000;
export const LOCK_SALT_BYTES = 16;
export const LOCK_MIN_CHARS = 8;
