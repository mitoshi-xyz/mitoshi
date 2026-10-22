"use client";

import type { Book } from "@mitoshi/venues/polymarket";
import { BookOpen } from "lucide-react";
import { EmptyState, Skeleton } from "@/kit";

const LEVELS = 7;
const CENTS = 100;
const cents = (p: number) => `${(p * CENTS).toFixed(1)}¢`;
const shares = (s: number) => s.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** The top of an outcome's book: asks above, bids below, the spread between, depth as bars. */
export function OrderBook({ book }: { book: Book | null }) {
  if (!book) return <Skeleton className="h-72 rounded-xl" label="Loading the order book" />;
  const asks = book.asks.slice(0, LEVELS).reverse();
  const bids = book.bids.slice(0, LEVELS);
  if (asks.length === 0 && bids.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No orders on the book yet"
        body="Prices appear here as soon as anyone quotes."
      />
    );
  }
  const spread = book.asks[0] && book.bids[0] ? book.asks[0].price - book.bids[0].price : null;
  const max = Math.max(1, ...asks.map((l) => l.size), ...bids.map((l) => l.size));
  const row = (l: { price: number; size: number }, side: "ask" | "bid") => (
    <li key={`${side}-${l.price}`} className="relative grid grid-cols-3 px-3 py-1 font-mono text-[12px]">
      <span
        className={`absolute inset-y-0.5 right-0 rounded-sm ${side === "ask" ? "bg-down-wash" : "bg-up-wash"}`}
        style={{ width: `${(l.size / max) * CENTS}%` }}
      />
      <span className={`relative ${side === "ask" ? "text-down" : "text-up"}`}>{cents(l.price)}</span>
      <span className="relative text-right text-ink-2">{shares(l.size)}</span>
      <span className="relative text-right text-muted">${shares(l.size * l.price)}</span>
    </li>
  );
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-surface-1 py-3">
      <div className="grid grid-cols-3 px-3 pb-1 type-label text-muted">
        <span>Price</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Total</span>
      </div>
      <ul>{asks.map((l) => row(l, "ask"))}</ul>
      <p className="border-hairline border-y px-3 py-1.5 text-center text-[12px] text-ink-2">
        {spread === null ? "–" : `Spread ${cents(spread)}`}
      </p>
      <ul>{bids.map((l) => row(l, "bid"))}</ul>
    </div>
  );
}
