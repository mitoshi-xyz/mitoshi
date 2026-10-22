/** Jupiter (keyless lite tier): Ultra swaps, token lists, prices. */
export const JUP_API = "https://lite-api.jup.ag";
/** GeckoTerminal public API: pools and OHLCV candles. */
export const GECKO_API = "https://api.geckoterminal.com/api/v2/networks/solana";
/** Solana mainnet RPC, used only for the plain SOL transfer home. */
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const LAMPORTS_PER_SOL = 1_000_000_000;
/** The base fee of a one-signature transaction. */
export const SIGNATURE_FEE_LAMPORTS = 5_000;
/** SOL kept back when buying with SOL, for fees and token-account rent. */
export const SWAP_RESERVE_LAMPORTS = 10_000_000;
/** Below this, SOL is not worth sending home (1Click's ZEC payout fee would eat it). */
export const DUST_LAMPORTS = 5_000_000;

/** Chart intervals and GeckoTerminal's (timeframe, aggregate) for each. */
export const CANDLE_INTERVALS = {
  "5m": ["minute", 5],
  "15m": ["minute", 15],
  "1h": ["hour", 1],
  "4h": ["hour", 4],
  "1d": ["day", 1],
} as const;

export type CandleInterval = keyof typeof CANDLE_INTERVALS;

export const CANDLE_LIMIT = 300;
export const TOKEN_LIST_LIMIT = 50;
