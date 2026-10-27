/** Zatoshis per ZEC. */
export const ZAT_PER_ZEC = 100_000_000;

/**
 * The standard amounts a private wallet is funded with (ZIP 318 style, n × 10^k with n in
 * {1, 2, 5}): 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5 and 1 ZEC. A funding is always exactly one of
 * these, so the one public hop (ZEC into NEAR's deposit address) looks like thousands of others.
 * 0.005 ZEC sits one step below ZIP 318's smallest denomination: a first trade for a few dollars.
 */
export const LADDER_ZAT = [
  500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000,
] as const;
/** The size offered first: 0.05 ZEC. */
export const DEFAULT_SIZE_ZAT = 5_000_000;

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** Value that arrived from a public address rests this long (sampled per note) before reuse. */
export const REST_MIN_MS = 2 * MS_PER_HOUR;
export const REST_MAX_MS = 6 * MS_PER_HOUR;

/**
 * A note whose origin is not known yet (its full transaction has not been fetched) is held this
 * many blocks at a time, and re-checked on every sync.
 */
export const UNKNOWN_ORIGIN_HOLD_BLOCKS = 10;

/**
 * Block spacing per network. Mainnet targets 75 s. Testnet's minimum-difficulty rule makes it
 * much faster in practice: about 22–25 s between blocks (measured 2026-10-22).
 */
export const BLOCK_SECONDS = { main: 75, test: 25 } as const;

/** A funding starts at a random moment in this window after it becomes due ("within ~3 min"). */
export const FUND_DELAY_MIN_MS = 20_000;
export const FUND_DELAY_MAX_MS = 3 * MS_PER_MINUTE;

/**
 * A keep-ready refill starts after an exponential delay with this mean, at most REFILL_MAX_MS (the shape ZIP 318 gives
 * migration transfers). The refill is needed because a ready wallet was just used, so its start must not follow that use.
 */
export const REFILL_MEAN_MS = 90 * MS_PER_MINUTE;
export const REFILL_MAX_MS = 12 * MS_PER_HOUR;

/** The leak meter compares a withdrawal with payouts received in this window. */
export const PAYOUT_MEMORY_MS = 48 * MS_PER_HOUR;

/** Within this fraction of a recent payout, a public withdrawal amount is flagged amber. */
export const NEAR_MATCH_FRACTION = 0.02;

/** Sending publicly this soon after a payout is flagged amber (timing correlation). */
export const TIMING_WINDOW_MS = 2 * MS_PER_HOUR;

/** NEAR 1Click's fixed fee for paying ZEC out (the trip home), in zatoshis. */
export const ONECLICK_ZEC_WITHDRAW_FEE_ZAT = 32_000;

/** BIP 32 / SLIP-10 paths for private wallets: our own purpose branch, every level hardened. */
export const PATH_PURPOSE = 44;
export const COIN_TYPE = { evm: 60, solana: 501 } as const;
/** "MTSH" on a phone keypad, so the branch is ours and never collides with a normal wallet's. */
export const MITOSHI_ACCOUNT = 6874;
export const VENUE_BRANCH = { polymarket: 0, hyperliquid: 1, solana: 2 } as const;

/* ZIP 318 (draft, zips.z.cash/zip-0318): moving Orchard value into Ironwood (migration.ts). */

/** The ZIP 317 fee of a canonical crossing: two Orchard actions and one Ironwood action at 5,000 zat each. */
export const CROSSING_FEE_ZAT = 15_000;

/** The smallest and largest denominations (ZIP 318 MAX_RESIDUAL_VALUE and DENOM_CAP): 0.01 ZEC and 10,000 ZEC. */
const HUNDREDTHS_PER_ZEC = 100;
const CAP_ZEC = 10_000;
export const MIN_DENOMINATION_ZAT = ZAT_PER_ZEC / HUNDREDTHS_PER_ZEC;
export const MAX_DENOMINATION_ZAT = CAP_ZEC * ZAT_PER_ZEC;

/**
 * Delays between transfers, in reference blocks of 75 s (ZIP 318 TRANSFER_DELAY_MEAN and TRANSFER_DELAY_CAP): an
 * exponential spread with a mean of 66 blocks (82.5 min), at most 576 (12 h). The wall-clock times hold after NU7.
 */
const REFERENCE_BLOCK_MS = 75_000;
const TRANSFER_DELAY_MEAN_BLOCKS = 66;
const TRANSFER_DELAY_CAP_BLOCKS = 576;
export const TRANSFER_DELAY_MEAN_MS = TRANSFER_DELAY_MEAN_BLOCKS * REFERENCE_BLOCK_MS;
export const TRANSFER_DELAY_CAP_MS = TRANSFER_DELAY_CAP_BLOCKS * REFERENCE_BLOCK_MS;

/** ZIP 318: the leading digits a denomination may have: n × 10^k ZEC with n in {1, 2, 5}. */
export const DENOMINATION_DIGITS = [1, 2, 5] as const;
export const DECADE = 10;
