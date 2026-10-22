/**
 * Polymarket Perps (docs.polymarket.com/perps): perpetuals on stocks, indices, commodities and
 * crypto, margined in pUSD. The REST API takes signed commands, so every call fits OHTTP.
 */
export const PERPS_API = "https://api.perpetuals.polymarket.com";

/** The public market-data socket (docs: Realtime Updates), reached only through the relay's feed. */
export const PERPS_WS = "wss://ws.perpetuals.polymarket.com/v1/ws";

/** Signatures use Polygon's chain id, as Polymarket's EIP-712 domain does ("Polymarket", "1"). */
export const PERPS_CHAIN_ID = 137;
export const PERPS_DOMAIN_NAME = "Polymarket";
export const PERPS_DOMAIN_VERSION = "1";

/** Deposits go into this contract from the Deposit Wallet; withdrawals are signed against it. */
export const PERPS_DEPOSIT_CONTRACT = "0xDCa4af75705dbB50f62437045afF9921947917d2";

/** Docs (Fund Your Account): "The minimum Perps deposit is 10 pUSD". */
export const PERPS_MIN_DEPOSIT_USD = 10;

/**
 * How long a proxy signer stays valid. The SDK's default is one week; a private wallet trades for
 * one position, so a week covers it, and a new proxy is authorised if one ever runs out.
 */
export const PROXY_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
/** Renew a proxy this long before it expires, so no order is signed by one about to lapse. */
export const PROXY_RENEW_MS = 60 * 60 * 1000;

/**
 * Market orders are IOC limits this far through the mark, so they fill without a runaway price.
 * Each instrument also bounds how far a price may sit from the mark (`price_bounds`).
 */
export const MARKET_SLIPPAGE = 0.01;

/** Below this, pUSD left in the Perps account is not worth a withdrawal. */
export const DUST_PUSD = 1;

/** Candle intervals the API serves (GET /v1/info/klines), with their length in milliseconds. */
export const PERPS_INTERVALS = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
} as const;

export type PerpsInterval = keyof typeof PERPS_INTERVALS;

/** How many candles a chart loads at first. */
export const PERPS_CANDLES_PER_VIEW = 300;

/** A client order id is 32 lowercase hex characters (16 random bytes). */
export const CLIENT_ORDER_ID_BYTES = 16;

/** Polymarket names its instruments `BASE-USD`; the app shows the base. */
export const SYMBOL_SUFFIX = "-USD";
