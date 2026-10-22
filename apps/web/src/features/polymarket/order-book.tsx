"use client";

import type { Book } from "@mitoshi/venues/polymarket";

const LEVELS = 6;
const CENTS = 100;
const cents = (p: number) => `${(p * CENTS).toFixed(1)}¢`;
const shares = (s: number) => s.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** The top of an outcome's book: asks above, bids below, the spread between. */
export function OrderBook({ book }: { book: Book | null }) {
  if (!book)
    return (
      <div role="status" aria-label="Loading the order book" className="h-64 animate-pulse rounded-xl bg-white/5" />
    );
  const asks = book.asks.slice(0, LEVELS).reverse();
  const bids = book.bids.slice(0, LEVELS);
  const spread = book.asks[0] && book.bids[0] ? book.asks[0].price - book.bids[0].price : null;
  const max = Math.max(1, ...asks.map((l) => l.size), ...bids.map((l) => l.size));
  const row = (l: { price: number; size: number }, side: "ask" | "bid") => (
    <li key={`${side}-${l.price}`} className="relative flex justify-between px-2 py-0.5 font-mono text-xs">
      <span
        className={`absolute inset-y-0 right-0 ${side === "ask" ? "bg-red-500/10" : "bg-emerald-500/10"}`}
        style={{ width: `${(l.size / max) * CENTS}%` }}
      />
      <span className={`relative ${side === "ask" ? "text-red-400" : "text-emerald-400"}`}>{cents(l.price)}</span>
      <span className="relative opacity-80">{shares(l.size)}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 p-3">
      <div className="flex justify-between px-2 text-xs opacity-50">
        <span>Price</span>
        <span>Shares</span>
      </div>
      {asks.length === 0 && bids.length === 0 ? (
        <p className="py-4 text-center text-xs opacity-60">No orders yet.</p>
      ) : null}
      <ul>{asks.map((l) => row(l, "ask"))}</ul>
      <p className="px-2 py-1 text-center text-xs opacity-60">{spread === null ? "–" : `Spread ${cents(spread)}`}</p>
      <ul>{bids.map((l) => row(l, "bid"))}</ul>
    </div>
  );
}
