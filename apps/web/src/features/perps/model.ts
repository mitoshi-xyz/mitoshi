import type { PrivateWallet, Venue as WalletVenue } from "@mitoshi/engine";
import type { LiveStatus } from "@mitoshi/venues/hyperliquid";

/**
 * The perps terminal's own model: one shape for every perpetuals venue, so the chart, ticket,
 * positions and lists are written once. Each venue fills it through its driver.
 */

export type PerpVenue = "hyperliquid" | "pmperps";

export interface PerpMarket {
  venue: PerpVenue;
  /** The market's id on its venue: a Hyperliquid coin ("BTC") or a Polymarket Perps symbol ("NVDA-USD"). */
  id: string;
  /** What the app shows ("BTC", "NVDA", "GOLD"). */
  name: string;
  /** "crypto", "equity", "index" or "commodity". */
  category: string;
  maxLeverage: number;
  onlyIsolated: boolean;
  markPx: number;
  midPx: number | null;
  prevDayPx: number;
  /** Funding per hour, as a fraction. */
  funding: number;
  openInterestUsd: number;
  dayVolumeUsd: number;
  minNotional: number;
  takerFee: number;
  /** A picture the venue publishes, for marks the app does not ship (stocks, commodities). */
  logo: string | null;
}

/** Live numbers for one market, straight from the venue's public feed. */
export interface PerpStats {
  markPx: number;
  prevDayPx?: number;
  funding?: number;
  openInterestUsd?: number;
  dayVolumeUsd?: number;
}

export interface PerpPosition {
  marketId: string;
  /** Signed size: positive long, negative short. */
  size: number;
  entryPx: number;
  valueUsd: number;
  unrealizedPnl: number;
  leverage: number;
  cross: boolean;
  liquidationPx: number | null;
  marginUsed: number;
}

export interface PerpOrder {
  marketId: string;
  oid: number;
  isBuy: boolean;
  px: number;
  size: number;
  reduceOnly: boolean;
  trigger: { px: number; kind: "tp" | "sl" } | null;
}

export interface PerpAccount {
  /** Usable as margin now, counting funding that still has to move in (spot USDC, Deposit Wallet pUSD). */
  free: number;
  withdrawable: number;
  equity: number;
  positions: PerpPosition[];
  orders: PerpOrder[];
}

export type PerpFill =
  | {
      kind: "filled";
      avgPx: number;
      size: number;
      oid: number;
      /** The TP/SL asked for did not attach (the venue refused one, or the entry filled only in part). */
      exitsMissing?: boolean;
    }
  | { kind: "resting"; oid: number };

export interface PerpOrderArgs {
  market: PerpMarket;
  isBuy: boolean;
  /** Size in the market's units (coins or contracts). */
  size: number;
  leverage: number;
  limitPx?: number;
  takeProfitPx?: number;
  stopLossPx?: number;
}

export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** How the terminal reaches one venue. Every call goes over OHTTP or the relay's public feed. */
export interface PerpDriver {
  venue: PerpVenue;
  /** The private-wallet venue its wallets are funded on. */
  wallet: WalletVenue;
  label: string;
  collateral: "USDC" | "pUSD";
  /** Candle intervals the venue serves. */
  intervals: readonly string[];
  markets(): Promise<PerpMarket[]>;
  onStatus(l: (s: LiveStatus) => void): () => void;
  /** Every trade and top-of-book change for one market. */
  subscribePrice(m: PerpMarket, cb: (px: number) => void): () => void;
  subscribeStats(m: PerpMarket, cb: (s: PerpStats) => void): () => void;
  /** Live marks for every market, by id. */
  subscribeMarks(cb: (marks: Record<string, number>) => void): () => void;
  candles(m: PerpMarket, interval: string, end?: number, count?: number): Promise<Bar[]>;
  subscribeCandle(m: PerpMarket, interval: string, cb: (b: Bar) => void): () => void;
  account(w: PrivateWallet): Promise<PerpAccount>;
  /** Places an order from a private wallet, moving its funding in first; `step` names what runs. */
  place(w: PrivateWallet, args: PerpOrderArgs, mark: number, step: (s: string) => void): Promise<PerpFill>;
  close(w: PrivateWallet, m: PerpMarket, p: PerpPosition, mark: number): Promise<PerpFill>;
  cancel(w: PrivateWallet, m: PerpMarket, oid: number): Promise<void>;
  sendHome(w: PrivateWallet): Promise<unknown>;
}

const PM_PREFIX = "pm/";

/** The terminal's address for a market: "/trade#BTC" (Hyperliquid) or "/trade#pm/NVDA-USD" (Polymarket Perps). */
export function terminalHref(m: { venue: PerpVenue; id: string }): string {
  return `/trade#${m.venue === "pmperps" ? PM_PREFIX : ""}${encodeURIComponent(m.id)}`;
}

/** Reads a terminal hash back into a venue and market id. */
export function parseTerminalHash(hash: string, fallback: string): { venue: PerpVenue; id: string } {
  const raw = decodeURIComponent(hash.replace(/^#/, ""));
  if (raw.startsWith(PM_PREFIX)) return { venue: "pmperps", id: raw.slice(PM_PREFIX.length) };
  return { venue: "hyperliquid", id: raw || fallback };
}

/** Plain words for a market's category, as the lists group them. */
export const CATEGORY_LABEL: Record<string, string> = {
  crypto: "Crypto",
  equity: "Stocks",
  index: "Indices",
  commodity: "Commodities",
};
