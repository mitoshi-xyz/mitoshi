"use client";

import type { Book, BookSide } from "@mitoshi/venues/polymarket";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { pmLive, pmMarket } from "./pm";

const EVENT_STALE_MS = 30_000;
const DEFAULT_TICK = 0.01;
const DEFAULT_MIN_SHARES = 5;

export function useEvent(id: string) {
  return useQuery({
    queryKey: ["polymarket", "event", id],
    queryFn: () => pmMarket.event(id),
    enabled: id.length > 0,
    staleTime: EVENT_STALE_MS,
  });
}

interface WsLevel {
  price: string;
  size: string;
}

interface WsEvent {
  event_type?: string;
  bids?: WsLevel[];
  asks?: WsLevel[];
  price_changes?: { price: string; size: string; side: "BUY" | "SELL" }[];
  price?: string;
  timestamp?: string;
}

function apply(levels: BookSide[], price: number, size: number, descending: boolean): BookSide[] {
  const rest = levels.filter((l) => l.price !== price);
  const next = size > 0 ? [...rest, { price, size }] : rest;
  return next.sort((a, b) => (descending ? b.price - a.price : a.price - b.price));
}

/**
 * An outcome's live order book: the REST snapshot first, then the market channel's snapshots
 * ("book") and level updates ("price_change"), plus the last trade.
 */
export function useLiveBook(tokenId: string | undefined) {
  const [book, setBook] = useState<Book | null>(null);
  const [lastTrade, setLastTrade] = useState<{ price: number; at: number } | null>(null);
  useEffect(() => {
    setBook(null);
    setLastTrade(null);
    if (!tokenId) return;
    let current = true;
    pmMarket.book(tokenId).then(
      (b) => current && setBook((prev) => prev ?? b),
      () => undefined,
    );
    const stop = pmLive().subscribe({ type: "market", assetId: tokenId }, (data) => {
      const e = data as WsEvent;
      if (e.event_type === "book") {
        const side = (v: WsLevel[] | undefined) =>
          (v ?? []).map((l) => ({ price: Number(l.price), size: Number(l.size) }));
        setBook((prev) => ({
          bids: side(e.bids).sort((a, b) => b.price - a.price),
          asks: side(e.asks).sort((a, b) => a.price - b.price),
          tickSize: prev?.tickSize ?? DEFAULT_TICK,
          minShares: prev?.minShares ?? DEFAULT_MIN_SHARES,
        }));
      } else if (e.event_type === "price_change") {
        setBook((prev) => {
          if (!prev) return prev;
          let { bids, asks } = prev;
          for (const c of e.price_changes ?? []) {
            if (c.side === "BUY") bids = apply(bids, Number(c.price), Number(c.size), true);
            else asks = apply(asks, Number(c.price), Number(c.size), false);
          }
          return { ...prev, bids, asks };
        });
      } else if (e.event_type === "last_trade_price" && e.price) {
        setLastTrade({ price: Number(e.price), at: Number(e.timestamp) || Date.now() });
      }
    });
    return () => {
      current = false;
      stop();
    };
  }, [tokenId]);
  return { book, lastTrade };
}
