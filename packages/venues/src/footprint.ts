/**
 * What anyone can see about one address on a venue, read from the venue's own public API: the
 * copy-trader's view of a private wallet. Counts are capped by what the API returns in one page.
 */
export interface PublicFootprint {
  /** Trades (Hyperliquid: distinct orders filled) or transactions (Solana: signatures). */
  activity: number;
  /** The venue returned a full page, so there are at least this many ("1,000+"). */
  activityCapped: boolean;
  /** Deposits and withdrawals into the account (Hyperliquid's ledger); null where it is not separate. */
  transfers: number | null;
  transfersCapped: boolean;
  /** Open positions right now; null where the venue has none to count. */
  openPositions: number | null;
  /** The first moment the address shows up on the venue (ms), or null if it never has. */
  firstSeen: number | null;
}
