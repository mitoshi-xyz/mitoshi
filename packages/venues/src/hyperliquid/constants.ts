/** Hyperliquid mainnet API (hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api). */
export const HL_API = "https://api.hyperliquid.xyz";

/** USDC on HyperCore spot, as `spotSend` names it (`tokenName:tokenId`, from spotMeta). */
export const HL_USDC_TOKEN = "USDC:0x6d1e7cde53ba9467b783cb7c530ce054";

/** A new HyperCore account's first inbound transfer costs this much USDC (activation fee). */
export const HL_ACTIVATION_FEE_USDC = 1;

/**
 * Hyperliquid's base-tier taker fee, 0.045% of notional (hyperliquid.gitbook.io/hyperliquid-docs/trading/fees); a
 * close at market pays it.
 */
export const HL_TAKER_FEE = 0.00045;

/** Market orders are IOC limits this far through the mid, so they fill without a runaway price. */
export const MARKET_SLIPPAGE = 0.01;

/** Below this, a USDC balance is not worth sending home (1Click's payout fee would eat it). */
export const DUST_USDC = 1;

/** Candle intervals the terminal offers, with their length in milliseconds. */
export const INTERVALS = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
} as const;

export type Interval = keyof typeof INTERVALS;

/** How many candles a chart loads at first. */
export const CANDLES_PER_VIEW = 300;

/** The most rows Hyperliquid's info endpoint returns for a user's fills or ledger in one answer. */
export const INFO_PAGE = 2_000;
