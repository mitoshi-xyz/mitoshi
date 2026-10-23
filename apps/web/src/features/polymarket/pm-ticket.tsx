"use client";

import { latestSwap } from "@mitoshi/engine";
import type { Book, PmMarket } from "@mitoshi/venues/polymarket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { useState } from "react";
import { CountdownRing, cue, cx, Keypad, pressKey, Segmented, TxCta, type TxPhase, Wait } from "@/kit";
import { usd } from "../format";
import { VenueMark } from "../marks/mark";
import { openFund, openPublicView } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { shortAddress } from "../private-wallets/venues";
import { TICKET_AMOUNTS as AMOUNTS } from "./constants";
import { pmMarket } from "./pm";
import { pmAccount } from "./pm-account";
import { PmOrders } from "./pm-orders";
import { placePmOrder, walletFor } from "./pm-trade";

const PCT = 100;
const MS_PER_SECOND = 1000;
const WALLET_REFRESH_MS = 15_000;
const SHARE_DIGITS = 2;
/** Room after the typed digits, so the amount stays centred as it grows. */
const CARET_CH = 0.5;

/** Walks one side of the book: how many shares `spend` buys (asks), or what `spend` shares sell for (bids). */
function fill(levels: { price: number; size: number }[], spend: number, bySize = false) {
  let left = spend;
  let shares = 0;
  let paid = 0;
  for (const level of levels) {
    if (left <= 0) break;
    const take = bySize ? Math.min(left, level.size) : Math.min(left, level.price * level.size) / level.price;
    shares += take;
    paid += take * level.price;
    left -= bySize ? take : take * level.price;
  }
  return { shares, paid, avg: shares > 0 ? paid / shares : 0, complete: left <= 0 };
}

export interface PmTicketProps {
  market: PmMarket;
  outcome: number;
  onOutcome: (i: number) => void;
  book: Book | null;
  /** Phones: the amount uses the keypad. */
  keypad?: boolean;
  /** Inside a sheet: no card of its own. */
  bare?: boolean;
}

/** Buy or sell an outcome from a private wallet, at market or with a limit, from the live book. */
export function PmTicket({ market, outcome, onOutcome, book, keypad = false, bare = false }: PmTicketProps) {
  const registry = useRegistry();
  const queries = useQueryClient();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [amount, setAmount] = useState("");
  const [limit, setLimit] = useState("");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [step, setStep] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const { wallet, holds } = walletFor(registry, market.conditionId);
  const pending = registry.wallets.find(
    (w) => w.venue === "polymarket" && (w.status === "preparing" || w.status === "funding"),
  );

  // The wallet's cash and its shares here, from Polymarket's public data (reading deploys nothing).
  const cash = useQuery({
    queryKey: ["polymarket", "pusd", wallet?.address],
    enabled: Boolean(wallet),
    refetchInterval: WALLET_REFRESH_MS,
    queryFn: () => pmMarket.pusd(wallet?.address ?? ""),
  });
  const held = useQuery({
    queryKey: ["polymarket", "positions", wallet?.address],
    enabled: Boolean(wallet && holds),
    refetchInterval: WALLET_REFRESH_MS,
    queryFn: () => pmMarket.positions(wallet?.address ?? ""),
  });
  const token = market.outcomes[outcome];
  const position = held.data?.find((p) => p.conditionId === market.conditionId && p.outcome === token?.label);
  const shares = position?.size ?? 0;

  const n = Number(amount) || 0;
  const limitPx = (Number(limit) || 0) / PCT;
  const levels = side === "buy" ? (book?.asks ?? []) : (book?.bids ?? []);
  const f =
    type === "market"
      ? fill(levels, n, side === "sell")
      : { shares: n, paid: n * limitPx, avg: limitPx, complete: true };
  const ask = book?.asks[0]?.price ?? token?.price ?? 0;
  const closed = market.closed || !market.acceptingOrders;
  const swap = pending ? latestSwap(pending, "fund") : undefined;
  const fundLeft = swap ? Math.max(0, swap.createdAt + swap.timeEstimateSeconds * MS_PER_SECOND - Date.now()) : 0;
  const spendUnit = side === "buy" && type === "market" ? "pUSD" : "shares";
  const tooMuch =
    (side === "buy" && cash.data !== undefined && (type === "market" ? n : f.paid) > cash.data) ||
    (side === "sell" && n > shares);
  const badLimit = type === "limit" && (limitPx <= 0 || limitPx >= 1);

  async function submit() {
    if (!wallet || n <= 0) return;
    setResult(null);
    setPhase("signing");
    try {
      const r = await placePmOrder({
        wallet,
        market,
        outcome,
        side,
        type,
        amount: String(n),
        ...(type === "limit" ? { price: String(limitPx) } : {}),
        onStep: (s) => {
          setStep(s);
          if (s.startsWith("Signing")) setPhase("sent");
        },
      });
      setPhase(r.ok ? "confirmed" : "failed");
      cue(r.ok ? "fill" : "error");
      setResult(r.ok ? r : { ok: false, text: `${r.text}. No money moved.` });
      if (r.ok) setAmount("");
      void queries.invalidateQueries({ queryKey: ["polymarket"] });
    } catch (e) {
      setPhase("failed");
      cue("error");
      setResult({ ok: false, text: `${e instanceof Error ? e.message : String(e)}. No money moved.` });
    } finally {
      setStep(null);
    }
  }

  async function redeem() {
    if (!wallet) return;
    setResult(null);
    setPhase("sent");
    try {
      await (await pmAccount(wallet)).redeem(market.conditionId);
      setPhase("confirmed");
      cue("win");
      setResult({ ok: true, text: `Redeemed: ${usd(shares)} in pUSD, in this wallet` });
      void queries.invalidateQueries({ queryKey: ["polymarket"] });
    } catch (e) {
      setPhase("failed");
      cue("error");
      setResult({ ok: false, text: `${e instanceof Error ? e.message : String(e)}. Nothing moved.` });
    }
  }

  const blocker =
    n <= 0 ? "Enter an amount" : badLimit ? "Set a limit between 1¢ and 99¢" : tooMuch ? "Lower the amount" : null;
  const ready = side === "sell" ? shares : cash.data;
  const warning =
    n > 0 && type === "market" && !f.complete
      ? "Thin book: it fills what it can"
      : n > 0 && side === "buy" && f.shares > 0 && f.shares < market.minShares
        ? `Minimum ${market.minShares} shares (≈ ${usd(market.minShares * ask)})`
        : null;
  const cells = [
    {
      label: side === "buy" ? "Cost" : "Shares",
      value: side === "buy" ? usd(type === "market" ? n : f.paid) : n.toFixed(SHARE_DIGITS),
    },
    {
      label: side === "buy" ? "To win" : "You get",
      value: side === "buy" ? usd(f.shares) : usd(f.paid),
      tone: side === "buy" ? "text-up" : "",
    },
    { label: "Chance", value: `${Math.round(ask * PCT)}%` },
  ];

  const redeemable = closed && wallet && holds && position?.redeemable;
  if (closed && !redeemable) {
    return (
      <div className={cx("flex flex-col gap-3", bare ? "" : "rounded-xl border border-hairline bg-surface-1 p-4")}>
        <div className="grid grid-cols-2 gap-2">
          {market.outcomes.map((o) => (
            <span
              key={o.tokenId}
              className="flex h-12 items-center justify-center rounded-xl bg-surface-2 font-semibold"
            >
              {o.label} {Math.round(o.price * PCT)}¢
            </span>
          ))}
        </div>
        <p className="text-center text-[13px] text-ink-2">Closed · not taking orders</p>
      </div>
    );
  }

  return (
    <div className={cx("flex flex-col gap-3", bare ? "" : "rounded-xl border border-hairline bg-surface-1 p-4")}>
      <div className="flex items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={side}
          onChange={setSide}
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
        />
        <Segmented
          size="sm"
          value={type}
          onChange={setType}
          options={[
            { value: "market", label: "Market" },
            { value: "limit", label: "Limit" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {market.outcomes.map((o, i) => (
          <button
            key={o.tokenId}
            type="button"
            onClick={() => onOutcome(i)}
            className={cx(
              "h-12 rounded-xl font-semibold transition-colors duration-[var(--dur-state)]",
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

      <div className="flex flex-col items-center gap-1 py-1">
        <label className="flex items-baseline justify-center gap-1">
          {spendUnit === "pUSD" ? (
            <span className="num font-semibold text-[40px] text-muted leading-none">$</span>
          ) : null}
          <input
            inputMode={keypad ? "none" : "decimal"}
            readOnly={keypad}
            aria-label={spendUnit === "pUSD" ? "Amount in pUSD" : "Shares"}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            style={{ width: `${Math.max(1, amount.length || 1) + CARET_CH}ch` }}
            className="num max-w-[9ch] bg-transparent text-center font-semibold text-[48px] leading-none outline-none placeholder:text-muted"
          />
          {spendUnit === "pUSD" ? null : <span className="text-[15px] text-muted">shares</span>}
        </label>
        {wallet && ready !== undefined ? (
          <button
            type="button"
            onClick={() => setAmount(side === "sell" ? String(shares) : ready.toFixed(SHARE_DIGITS))}
            className="num text-[13px] text-ink-2 hover:text-ink"
          >
            {side === "sell" ? `${shares.toFixed(SHARE_DIGITS)} held` : `${usd(ready)} ready`} · Max
          </button>
        ) : null}
      </div>

      {spendUnit === "pUSD" ? (
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
      ) : null}
      {keypad ? <Keypad onKey={(k) => setAmount((a) => pressKey(a, k, SHARE_DIGITS))} /> : null}

      {type === "limit" ? (
        <label className="flex items-center gap-2 rounded-full border border-hairline bg-surface-2 px-4">
          <span className="text-[13px] text-muted">Limit</span>
          <input
            className="h-10 min-w-0 flex-1 bg-transparent text-right font-mono text-[15px] outline-none"
            inputMode="decimal"
            placeholder={String(Math.round(ask * PCT))}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <span className="text-[13px] text-muted">¢</span>
        </label>
      ) : null}

      <div className="grid grid-cols-3 divide-x divide-[var(--hairline)] rounded-xl bg-surface-2 py-2.5">
        {cells.map((c) => (
          <span key={c.label} className="flex flex-col items-center leading-tight">
            <span className="text-[11px] text-muted">{c.label}</span>
            <span className={cx("num font-semibold text-[14px]", c.tone)}>{c.value}</span>
          </span>
        ))}
      </div>
      {warning ? <p className="text-center text-[12px] text-warning">{warning}</p> : null}

      {closed && wallet && holds && position?.redeemable ? (
        <TxCta
          tone="up"
          phase={phase === "confirmed" || phase === "failed" ? "idle" : phase}
          label={`Redeem ${shares.toFixed(SHARE_DIGITS)} winning shares`}
          onClick={() => void redeem()}
        />
      ) : closed ? (
        <p className="rounded-lg bg-surface-2 p-3 text-center text-[13px] text-ink-2">Not taking orders.</p>
      ) : wallet ? (
        <>
          <TxCta
            tone={side === "buy" ? "up" : "down"}
            phase={phase === "confirmed" || phase === "failed" ? "idle" : phase}
            label={`${side === "buy" ? "Buy" : "Sell"} ${token?.label ?? ""}${type === "limit" ? " at limit" : ""}`}
            onClick={() => void submit()}
            {...(blocker && n > 0 ? { fix: { label: blocker, onClick: () => undefined } } : {})}
          />
          <button
            type="button"
            onClick={() => openPublicView(wallet.id)}
            className="num flex items-center justify-center gap-1.5 text-[12px] text-muted hover:text-ink"
          >
            <VenueMark venue="polymarket" size={14} /> {holds ? "Holding wallet" : "Fresh wallet"}{" "}
            {shortAddress(wallet.address)} <Eye size={11} />
          </button>
          {step ? <Wait verb={step} /> : null}
        </>
      ) : pending ? (
        <div className="flex items-center justify-center gap-3 rounded-xl bg-accent-wash p-3">
          <CountdownRing fraction={swap ? fundLeft / (swap.timeEstimateSeconds * MS_PER_SECOND) : 1} size={28} />
          <span className="text-[13px]">Wallet funding</span>
        </div>
      ) : (
        <TxCta
          label="Buy"
          onClick={() => undefined}
          fix={{ label: "Fund a private wallet", onClick: () => openFund("polymarket") }}
        />
      )}
      {result ? (
        <p
          className={cx(
            "rounded-lg px-3 py-2 text-center text-[13px]",
            result.ok ? "bg-up-wash text-up" : "bg-down-wash text-down",
          )}
        >
          {result.text}
        </p>
      ) : null}
      {wallet && holds ? <PmOrders wallet={wallet} /> : null}
    </div>
  );
}
