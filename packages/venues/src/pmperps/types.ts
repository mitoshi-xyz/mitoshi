import type { Hex } from "viem";
import type { PerpsMarket } from "./market.ts";

/** A delegated signer for trading: the owner authorises it once, and it signs every order. */
export interface PerpsCredentials {
  proxy: Hex;
  proxyKey: Hex;
  secret: string;
  /** When the proxy stops being valid (ms). */
  expiry: number;
}

export interface PerpsPosition {
  id: number;
  symbol: string;
  /** Signed size in contracts: positive long, negative short. */
  size: number;
  entryPx: number;
  leverage: number;
  cross: boolean;
  marginUsed: number;
  valueUsd: number;
  liquidationPx: number | null;
  unrealizedPnl: number;
  funding: number;
}

export interface PerpsOpenOrder {
  oid: number;
  instrumentId: number;
  isBuy: boolean;
  px: number;
  size: number;
  reduceOnly: boolean;
  trigger: { kind: "tp" | "sl"; px: number } | null;
  at: number;
}

export interface PerpsAccountState {
  /** Total account value (equity plus unrealised PnL). */
  equity: number;
  /** What new orders can use as margin. */
  available: number;
  /** What can leave the account now (after the 10% notional reserve). */
  withdrawable: number;
  inLiquidation: boolean;
  positions: PerpsPosition[];
  orders: PerpsOpenOrder[];
}

export type PerpsOrderResult =
  | {
      kind: "filled";
      avgPx: number;
      size: number;
      oid: number;
      /** TP/SL asked for but not on the book (a child refused, or the entry filled only in part, which cancels them). */
      exitsMissing?: boolean;
    }
  | { kind: "resting"; oid: number };

export interface PerpsOrderInput {
  market: PerpsMarket;
  isBuy: boolean;
  /** Size in contracts. */
  size: number;
  /** Limit price (GTC); market orders are IOC limits MARKET_SLIPPAGE through the mark. */
  limitPx?: number;
  reduceOnly?: boolean;
  takeProfitPx?: number;
  stopLossPx?: number;
}

/** An order as the account endpoints return it. */
export interface RawOrder {
  order_id: number;
  instrument_id: number;
  buy: boolean;
  price: string;
  quantity: string;
  ro: boolean;
  status: string;
  filled_quantity: string;
  resting_quantity: string;
  created_timestamp: number;
  client_order_id?: string;
  tpsl?: { kind: "tp" | "sl"; trp: string };
}
