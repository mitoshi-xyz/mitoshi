/**
 * The private-wallet registry: every wallet this device has made, its venue, key index, size, the
 * swaps that funded and emptied it, and its status timeline. It lives only in the encrypted
 * device vault; no server ever holds it.
 */

export type Venue = "polymarket" | "hyperliquid" | "solana";

export type WalletStatus =
  | "preparing"
  | "funding"
  | "ready"
  | "trading"
  | "returning"
  | "retired"
  | "refunded"
  | "failed";

/** NEAR 1Click's swap states, plus QUOTED before any deposit is sent. */
export type SwapStatus =
  | "QUOTED"
  | "KNOWN_DEPOSIT_TX"
  | "PENDING_DEPOSIT"
  | "INCOMPLETE_DEPOSIT"
  | "PROCESSING"
  | "SUCCESS"
  | "REFUNDED"
  | "FAILED";

export interface SwapRecord {
  kind: "fund" | "return";
  depositAddress: string;
  /** Base units of the asset going in. */
  amountIn: string;
  /** Expected and minimum output, base units of the asset coming out. */
  amountOut: string;
  minAmountOut: string;
  refundTo: string;
  recipient: string;
  timeEstimateSeconds: number;
  /** When 1Click refunds if the deposit has not arrived. */
  deadline: string;
  status: SwapStatus;
  /** Which 1Click asset it delivers (a funding may take one of several routes, e.g. USDC on Arbitrum). */
  asset?: string;
  /** The deposit transaction (ZEC txid for fundings, venue tx or action for returns). */
  depositTx?: string;
  /** What actually arrived, once settled. */
  settledOut?: string;
  /** The transaction that delivered it (for a trip home, the ZEC payout's txid). */
  settledTx?: string;
  refundedAmount?: string;
  /**
   * Polymarket only: the bridge leg after NEAR delivers (USDC at the wallet's bridge address
   * becomes pUSD in the wallet). The funding is done when this is COMPLETED.
   */
  bridge?: { status: string; txHash?: string };
  createdAt: number;
  updatedAt: number;
  /** The full signed quote, kept to settle any dispute with 1Click. */
  signedQuote: unknown;
}

/** One trade a wallet made, kept so the portfolio knows its cost and its history. */
export interface TradeRecord {
  at: number;
  /** In words: "Long BTC 5×", "Bought BONK". */
  label: string;
  /** Hyperliquid: the coin; Solana: the token mint; Polymarket: the outcome token. */
  asset: string;
  side: "buy" | "sell";
  /** Base units in and out (Solana) or coins and USD (Hyperliquid). */
  inAmount: string;
  outAmount: string;
  /** What went in, in USD at the time: the cost basis. */
  usd: number | null;
  /** The venue's transaction id or order id. */
  ref?: string;
}

export interface TimelineEvent {
  status: WalletStatus;
  at: number;
  note?: string;
}

export interface PrivateWallet {
  id: string;
  venue: Venue;
  /** Derivation index on the venue's branch. */
  index: number;
  address: string;
  /** The standard amount that funded it, in zatoshis. */
  sizeZat: number;
  status: WalletStatus;
  createdAt: number;
  timeline: TimelineEvent[];
  swaps: SwapRecord[];
  /** Funding scheduled for this moment (random, never immediate). */
  fundAt?: number;
  /** Made by "keep one ready" to replace a used wallet, so it starts after a long random delay (refillTime). */
  refill?: boolean;
  /** Trades made from this wallet, oldest first. */
  trades?: TradeRecord[];
  /** Found again from the recovery words (its funding record was not on this device). */
  recovered?: boolean;
  /** The venue account is set up for trading (Polymarket: Deposit Wallet deployed and approvals given). */
  prepared?: boolean;
  /**
   * Polymarket Perps: the proxy signer this wallet's own key authorised to trade its Perps account
   * (encrypted with the rest of the registry; a new one is authorised if it is lost or expires).
   */
  perps?: { proxy: `0x${string}`; proxyKey: `0x${string}`; secret: string; expiry: number };
  error?: string;
}

export interface Registry {
  version: 1;
  nextIndex: Record<Venue, number>;
  wallets: PrivateWallet[];
  /** "Keep one ready": the size (zatoshis) of a funded wallet to hold per venue while the app is open. */
  keepReady: Record<Venue, number | null>;
}

export function emptyRegistry(): Registry {
  return {
    version: 1,
    nextIndex: { polymarket: 0, hyperliquid: 0, solana: 0 },
    wallets: [],
    keepReady: { polymarket: null, hyperliquid: null, solana: null },
  };
}

/** Which status may follow which. A refund or failure can happen at any live step. */
export const NEXT: Record<WalletStatus, readonly WalletStatus[]> = {
  preparing: ["funding", "failed"],
  funding: ["ready", "refunded", "failed"],
  ready: ["trading", "returning"],
  trading: ["ready", "returning"],
  returning: ["retired", "failed"],
  retired: [],
  refunded: [],
  failed: ["preparing", "funding", "returning"],
};

export function canAdvance(from: WalletStatus, to: WalletStatus): boolean {
  return NEXT[from].includes(to);
}

/** Moves a wallet to `status`, recording it on the timeline. Throws on a move the flow never makes. */
export function advance(w: PrivateWallet, status: WalletStatus, at: number, note?: string): PrivateWallet {
  if (w.status === status) return w;
  if (!canAdvance(w.status, status)) throw new Error(`a ${w.status} wallet cannot become ${status}`);
  const event: TimelineEvent = note === undefined ? { status, at } : { status, at, note };
  return { ...w, status, timeline: [...w.timeline, event] };
}

/** Live wallets for a venue (not retired, refunded or failed). */
export function liveWallets(r: Registry, venue: Venue): PrivateWallet[] {
  return r.wallets.filter((w) => w.venue === venue && !["retired", "refunded", "failed"].includes(w.status));
}

/** A ready, unused wallet for the venue, if one is waiting. */
export function readyWallet(r: Registry, venue: Venue): PrivateWallet | undefined {
  return r.wallets.find((w) => w.venue === venue && w.status === "ready" && !w.swaps.some((s) => s.kind === "return"));
}

export function updateWallet(r: Registry, id: string, f: (w: PrivateWallet) => PrivateWallet): Registry {
  return { ...r, wallets: r.wallets.map((w) => (w.id === id ? f(w) : w)) };
}

/** The latest swap of a kind on a wallet. */
export function latestSwap(w: PrivateWallet, kind: SwapRecord["kind"]): SwapRecord | undefined {
  return [...w.swaps].reverse().find((s) => s.kind === kind);
}
