"use client";

import { useEffect, useState } from "react";
import type { PerpMarket } from "../perps/model";
import { DEFAULT_LEVERAGE, MAINTENANCE_SHARE, PCT } from "./constants";

export type Side = "long" | "short";

/** Everything the ticket holds: shared by the desktop column and the phone sheet. */
export interface Order {
  side: Side;
  /** Margin in USD, as typed (a string, never a float until it is read). */
  margin: string;
  leverage: number;
  kind: "market" | "limit";
  limit: string;
  /** Exit prices, as typed; empty means none. */
  tp: string;
  sl: string;
}

export function useOrder(market: PerpMarket | undefined) {
  const [order, setOrder] = useState<Order>({
    side: "long",
    margin: "",
    leverage: DEFAULT_LEVERAGE,
    kind: "market",
    limit: "",
    tp: "",
    sl: "",
  });
  const maxLeverage = market?.maxLeverage;
  const marketKey = market ? `${market.venue}:${market.id}` : "";
  // A new market: keep the amount and side, clamp leverage, drop prices that belonged to the old one.
  useEffect(() => {
    setOrder((o) => ({
      ...o,
      leverage: Math.min(Math.max(1, o.leverage), maxLeverage ?? o.leverage),
      limit: "",
      tp: "",
      sl: "",
    }));
  }, [marketKey]);
  /** A patch, or a function of the latest order (taps that land in one frame must not overwrite each other). */
  const set = (patch: Partial<Order> | ((o: Order) => Partial<Order>)) =>
    setOrder((o) => ({ ...o, ...(typeof patch === "function" ? patch(o) : patch) }));
  return [order, set] as const;
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

/**
 * Where a fresh position would be liquidated. Orders go in cross margin (each venue is set that way), so the whole
 * account backs the position: it is liquidated when the account's equity falls to the maintenance margin, half the
 * max-leverage margin. That is Hyperliquid's rule; for a live 10× BTC long it gave 48,550 against Hyperliquid's own
 * 48,519.5. An isolated-only market, or an account with nothing in it yet, backs it with its own margin alone. Null
 * when the account covers a long all the way down.
 */
export function liquidationPx(p: {
  entry: number;
  size: number;
  leverage: number;
  maxLeverage: number;
  isLong: boolean;
  /** The account's equity, the margin of this order included. */
  equity: number;
  isolated: boolean;
}): number | null {
  const mm = 1 / (MAINTENANCE_SHARE * p.maxLeverage);
  if (p.isolated || p.equity <= 0 || p.size <= 0) {
    return p.isLong ? p.entry * (1 - 1 / p.leverage + mm) : p.entry * (1 + 1 / p.leverage - mm);
  }
  const px = p.isLong
    ? (p.size * p.entry - p.equity) / (p.size * (1 - mm))
    : (p.equity + p.size * p.entry) / (p.size * (1 + mm));
  return px > 0 ? px : null;
}

/** What the ticket would place, read from the typed order; `equity` is the wallet's account, for the liquidation. */
export function quoteOrder(o: Order, market: PerpMarket, mark: number, equity = 0) {
  const isLong = o.side === "long";
  const margin = Number(o.margin) || 0;
  const entry = o.kind === "limit" ? (num(o.limit) ?? mark) : mark;
  const notional = margin * o.leverage;
  const size = entry > 0 ? notional / entry : 0;
  const tp = num(o.tp);
  const sl = num(o.sl);
  return {
    isLong,
    margin,
    entry,
    notional,
    size,
    liquidation:
      notional > 0
        ? liquidationPx({
            entry,
            size,
            leverage: o.leverage,
            maxLeverage: market.maxLeverage,
            isLong,
            equity,
            isolated: market.onlyIsolated,
          })
        : null,
    fee: notional * market.takerFee,
    tp,
    sl,
    /** Profit or loss in USD if the price reaches `px`. */
    pnlAt: (px: number) => (isLong ? px - entry : entry - px) * size,
  };
}

/** The exit price for a return of `pct` percent on the margin (a negative pct is a loss). */
export function priceForReturn(entry: number, leverage: number, isLong: boolean, pct: number): number {
  const move = pct / PCT / leverage;
  return isLong ? entry * (1 + move) : entry * (1 - move);
}
