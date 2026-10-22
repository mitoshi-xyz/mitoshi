"use client";

import { latestSwap, readyWallet } from "@mitoshi/engine";
import type { Book, PmMarket } from "@mitoshi/venues/polymarket";
import { KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CountdownRing, cx, Segmented } from "@/kit";
import { usd } from "../format";
import { VenueMark } from "../marks/mark";
import { useRegistry } from "../private-wallets/registry-store";
import { TICKET_AMOUNTS as AMOUNTS } from "./constants";

const PCT = 100;
const MS_PER_SECOND = 1000;

/** Walks one side of the book: how many shares `spend` buys (asks) or what `shares` sell for (bids). */
function fill(
  levels: { price: number; size: number }[],
  spend: number,
): { shares: number; avg: number; complete: boolean } {
  let left = spend;
  let shares = 0;
  for (const level of levels) {
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

/** Buy an outcome from a private wallet: shares, average price, payout and chance from the live book. */
export function PmTicket({ market, outcome, onOutcome, book }: PmTicketProps) {
  const registry = useRegistry();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const spend = Number(amount) || 0;
  const f = fill(book?.asks ?? [], spend);
  const wallet = readyWallet(registry, "polymarket");
  const pending = registry.wallets.find(
    (w) => w.venue === "polymarket" && (w.status === "preparing" || w.status === "funding"),
  );
  const ask = book?.asks[0]?.price ?? market.outcomes[outcome]?.price ?? 0;
  const minSpend = market.minShares * ask;
  const closed = market.closed || !market.acceptingOrders;
  const swap = pending ? latestSwap(pending, "fund") : undefined;
  const fundLeft = swap ? Math.max(0, swap.createdAt + swap.timeEstimateSeconds * MS_PER_SECOND - Date.now()) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
      <Segmented
        size="sm"
        value={side}
        onChange={setSide}
        options={[
          { value: "buy", label: "Buy" },
          { value: "sell", label: "Sell" },
        ]}
      />
      <p className="line-clamp-2 text-[13px] text-ink-2">{market.title}</p>
      <div className="grid grid-cols-2 gap-2">
        {market.outcomes.map((o, i) => (
          <button
            key={o.tokenId}
            type="button"
            onClick={() => onOutcome(i)}
            className={cx(
              "h-12 rounded-lg font-semibold transition-colors duration-[var(--dur-state)]",
              outcome === i
                ? i === 0
                  ? "bg-up text-bg"
                  : "bg-down text-bg"
                : i === 0
                  ? "border border-up/30 bg-up-wash text-up"
                  : "border border-down/30 bg-down-wash text-down",
            )}
          >
            {o.label} {Math.round(o.price * PCT)}¢
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="type-label text-muted">Amount</span>
        <div className="relative">
          <input
            className="h-12 w-full rounded-lg border border-hairline bg-bg px-3 font-mono text-[18px] outline-none focus:border-strong"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">USDC</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              className="h-8 rounded-full bg-surface-2 text-[12px] text-ink-2 hover:text-ink"
            >
              ${a}
            </button>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-bg/60 p-3 text-[13px]">
        <dt className="text-ink-2">Shares</dt>
        <dd className="num text-right">{f.shares ? f.shares.toFixed(2) : "0"}</dd>
        <dt className="text-ink-2">Average price</dt>
        <dd className="num text-right">{f.avg ? `${(f.avg * PCT).toFixed(1)}¢` : "–"}</dd>
        <dt className="text-ink-2">To win</dt>
        <dd className="num text-right font-semibold text-up">{usd(f.shares)}</dd>
        <dt className="text-ink-2">Chance now</dt>
        <dd className="num text-right">{Math.round(ask * PCT)}%</dd>
        <dt className="text-ink-2">Mitoshi fee</dt>
        <dd className="text-right">none on trades</dd>
      </dl>
      {spend > 0 && !f.complete ? (
        <p className="text-[12px] text-warning">Not enough on the book for that amount.</p>
      ) : null}
      {spend > 0 && spend < minSpend ? (
        <p className="text-[12px] text-warning">
          Polymarket's minimum is {market.minShares} shares (≈ {usd(minSpend)}).
        </p>
      ) : null}

      {closed ? (
        <p className="rounded-lg bg-surface-2 p-3 text-[13px] text-ink-2">This market is not taking orders.</p>
      ) : pending ? (
        <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent-wash p-3">
          <CountdownRing fraction={swap ? 1 - fundLeft / (swap.timeEstimateSeconds * MS_PER_SECOND) : 0} size={30} />
          <span className="text-[13px]">Your Polymarket wallet is funding. It is ready in a few minutes.</span>
        </div>
      ) : wallet ? (
        <div className="flex items-start gap-3 rounded-lg border border-hairline bg-surface-2/60 p-3">
          <KeyRound size={18} className="mt-0.5 shrink-0 text-accent" />
          <span className="text-[13px] text-ink-2">
            Your private Polymarket wallet is ready. Orders switch on once Mitoshi's builder relayer key is set;
            everything else on this page is live.
          </span>
        </div>
      ) : (
        <Link
          href="/wallets"
          className="flex items-center gap-3 rounded-lg border border-dashed border-strong p-3 transition-colors hover:border-accent hover:bg-accent-wash"
        >
          <VenueMark venue="polymarket" size={30} />
          <span className="flex flex-col leading-tight">
            <span className="flex items-center gap-1.5 font-medium text-sm">
              <Sparkles size={14} className="text-accent" /> Fund a Polymarket wallet
            </span>
            <span className="text-[12px] text-ink-2">A brand-new account from your shielded ZEC, in ~8 min.</span>
          </span>
        </Link>
      )}
    </div>
  );
}
