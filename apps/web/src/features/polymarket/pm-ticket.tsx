"use client";

import { readyWallet } from "@mitoshi/engine";
import type { Book, PmMarket } from "@mitoshi/venues/polymarket";
import Link from "next/link";
import { useState } from "react";
import { usd } from "../format";
import { useRegistry } from "../private-wallets/registry-store";

const CENTS = 100;

/** Walks the asks: how many shares `spend` dollars buys, and at what average price. */
function fill(book: Book | null, spend: number): { shares: number; avg: number; complete: boolean } {
  let left = spend;
  let shares = 0;
  for (const level of book?.asks ?? []) {
    if (left <= 0) break;
    const cost = Math.min(left, level.price * level.size);
    shares += cost / level.price;
    left -= cost;
  }
  return { shares, avg: shares > 0 ? (spend - left) / shares : 0, complete: left <= 0 };
}

export interface PmTicketProps {
  market: PmMarket;
  outcome: number;
  onOutcome: (i: number) => void;
  book: Book | null;
}

/** Buy an outcome from a private wallet: shares, average price and payout from the live book. */
export function PmTicket({ market, outcome, onOutcome, book }: PmTicketProps) {
  const registry = useRegistry();
  const [amount, setAmount] = useState("");
  const spend = Number(amount) || 0;
  const f = fill(book, spend);
  const wallet = readyWallet(registry, "polymarket");
  const minSpend = market.minShares * (book?.asks[0]?.price ?? market.outcomes[outcome]?.price ?? 0);
  const closed = market.closed || !market.acceptingOrders;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-4">
      <p className="text-sm opacity-80">{market.title}</p>
      <div className="grid grid-cols-2 gap-2">
        {market.outcomes.map((o, i) => (
          <button
            key={o.tokenId}
            type="button"
            onClick={() => onOutcome(i)}
            className={`rounded-lg py-2 font-medium ${outcome === i ? (i === 0 ? "bg-emerald-500 text-black" : "bg-red-500 text-black") : "border border-white/20"}`}
          >
            {o.label} {Math.round(o.price * CENTS)}¢
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs opacity-80">
        Amount (USDC)
        <input
          className="rounded-lg border border-white/20 bg-transparent px-3 py-2 font-mono text-sm"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        <dt className="opacity-60">Shares</dt>
        <dd className="text-right font-mono">{f.shares ? f.shares.toFixed(2) : "0"}</dd>
        <dt className="opacity-60">Average price</dt>
        <dd className="text-right font-mono">{f.avg ? `${(f.avg * CENTS).toFixed(1)}¢` : "–"}</dd>
        <dt className="opacity-60">Pays if right</dt>
        <dd className="text-right font-mono">{usd(f.shares)}</dd>
        <dt className="opacity-60">Mitoshi fee</dt>
        <dd className="text-right font-mono">none on trades</dd>
      </dl>
      {spend > 0 && !f.complete ? (
        <p className="text-amber-400 text-xs">Not enough liquidity on the book for that amount.</p>
      ) : null}
      {spend > 0 && spend < minSpend ? (
        <p className="text-amber-400 text-xs">
          Polymarket's minimum is {market.minShares} shares (≈ {usd(minSpend)}).
        </p>
      ) : null}
      <button type="button" disabled className="rounded-lg bg-white py-2 font-medium text-black disabled:opacity-40">
        Buy {market.outcomes[outcome]?.label}
      </button>
      <p className="text-xs opacity-60">
        {closed
          ? "This market is not taking orders."
          : !wallet
            ? "No Polymarket private wallet is ready yet."
            : "Polymarket orders switch on once Mitoshi's builder relayer key is set."}{" "}
        <Link href="/wallets" className="underline">
          Private wallets
        </Link>
      </p>
    </div>
  );
}
