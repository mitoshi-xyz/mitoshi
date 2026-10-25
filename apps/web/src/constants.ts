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

/**
 * After a broadcast the wallet does not sync for a random 1–10 min, so a broadcast and a sync never share a window
 * (ZIP 318): the gateway sees no send followed at once by the same wallet's block reads.
 */
/**
 * Exchange deposits: one transparent address is checked per round, at a random spacing, so the gateway never sees a
 * wallet's addresses asked about together; an address is watched for a week after it is handed out.
 */
export const EXCHANGE_CHECK_MIN_MS = 45_000;
export const EXCHANGE_CHECK_MAX_MS = 120_000;
export const EXCHANGE_WATCH_MS = 7 * 24 * 60 * 60 * 1000;
export const SEND_QUIET_MIN_MS = 60_000;
export const SEND_QUIET_MAX_MS = 600_000;

/** Ironwood (NU6.3) activation: restored wallets scan from here, since every newer shielded note lives in Ironwood. */
export const IRONWOOD_ACTIVATION = { main: 3_428_143, test: 4_134_000 } as const;

export const VAULT_DB = { name: "mitoshi-vault", version: 1, keys: "keys", records: "records" } as const;
export const VAULT_KEY_BITS = 256;
export const VAULT_IV_BYTES = 12;
/** The passphrase lock: PBKDF2-SHA-256 at OWASP's 2023 count, with a 16-byte salt. */
export const LOCK_PBKDF2_ITERATIONS = 600_000;
export const LOCK_SALT_BYTES = 16;
export const LOCK_MIN_CHARS = 8;

/** The documentation site (apps/docs). Old /docs links on this site redirect there (services/web). */
export const DOCS_URL = "https://docs.mitoshi.xyz";

/**
 * Where a receipt's "Verify it on chain" goes: the Nighthawk Zcash explorer (open source, nighthawk-apps/zcash-explorer).
 * It is a link the person opens in their own browser, never a request the app makes.
 */
/**
 * The judges' desks: six wallets funded before judging, each with a Hyperliquid wallet ready to trade, opened at
 * judge.mitoshi.xyz with the key in the submission's link. That origin has storage of its own, so a desk never shares
 * a vault with a wallet on mitoshi.xyz.
 */
export const JUDGE_HOST = "judge.mitoshi.xyz";
export const JUDGE_ORIGIN = `https://${JUDGE_HOST}`;
export const DESK_COUNT = 6;
/**
 * The landing points judges at their desks only in a build that ships them (NEXT_PUBLIC_DESKS_LIVE=1, set by the
 * deploy that publishes public/desks), so nobody reads "your desk is funded" before it is.
 */
export const DESKS_LIVE = process.env.NEXT_PUBLIC_DESKS_LIVE === "1";
/** Where the sealed desks are served (static files, each encrypted under a key only the judges' link carries). */
export const DESK_FILES = "/desks";
/** A desk's ready wallet: 0.01 ZEC to Hyperliquid, funded through Mitoshi before judging. */
export const DESK_READY_ZAT = 1_000_000;
/**
 * What the treasury pays each desk: the ready wallet, 0.01 ZEC to fund a brand-new wallet live, and both fees. Test
 * desks (a rehearsal of the flow; testnet has no NEAR route to fund anything) get small change.
 */
export const DESK_SHARE_ZAT = ZEC_NETWORK === "main" ? 2_030_000 : 150_000;

export const ZEC_EXPLORER = {
  main: "https://mainnet.zcashexplorer.app",
  test: "https://testnet.zcashexplorer.app",
} as const;
