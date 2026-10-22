/** The Mitoshi gateway (OHTTP gateway, public-data proxy, lightwalletd relay). */
export const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY ?? "https://mitoshi-gateway.kakure-price-relay.workers.dev";

/** Zcash network the app runs on. Development uses testnet; production is mainnet. */
export const ZEC_NETWORK: "main" | "test" = process.env.NEXT_PUBLIC_ZEC_NETWORK === "main" ? "main" : "test";

/** The lightwalletd route on the gateway for the current network. */
export const LWD_BASE = `${GATEWAY}/lwd/${ZEC_NETWORK}`;

/** How often an open wallet checks for new blocks. */
export const WALLET_SYNC_INTERVAL_MS = 30_000;

/** Ironwood (NU6.3) activation: restored wallets scan from here, since every newer shielded note lives in Ironwood. */
export const IRONWOOD_ACTIVATION = { main: 3_428_143, test: 4_134_000 } as const;

export const VAULT_DB = { name: "mitoshi-vault", version: 1, keys: "keys", records: "records" } as const;
export const VAULT_KEY_BITS = 256;
export const VAULT_IV_BYTES = 12;
