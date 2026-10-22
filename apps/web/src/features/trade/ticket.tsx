"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import type { AccountState, Perp } from "@mitoshi/venues/hyperliquid";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { price, usd } from "../format";
import { hlAccount } from "../hyperliquid/hl";
import { markTrading } from "../private-wallets/home";

/** Hyperliquid's base taker fee (tier 0), shown as an estimate before you confirm. */
const TAKER_FEE = 0.00045;
/** Hyperliquid refuses orders below this notional. */
const MIN_NOTIONAL_USD = 10;
const DEFAULT_LEVERAGE = 3;
const MAINTENANCE_SHARE = 2;
/** Tolerance when comparing a typed margin with the wallet balance. */
const EPSILON = 1e-9;
const ADDRESS_HEAD = 8;
const SIZE_SIG_DIGITS = 4;

type Step =
  | { kind: "idle" }
  | { kind: "working"; what: string }
  | { kind: "done"; text: string }
  | { kind: "failed"; text: string };

/** Approximate liquidation price for a fresh cross position (maintenance = half of max-leverage margin). */
function liquidationPx(entry: number, leverage: number, maxLeverage: number, isLong: boolean): number {
  const mm = 1 / (MAINTENANCE_SHARE * maxLeverage);
  return isLong ? entry * (1 - 1 / leverage + mm) : entry * (1 + 1 / leverage - mm);
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

export interface TicketProps {
  perp: Perp;
  mark: number;
  wallet: PrivateWallet | undefined;
  state: AccountState | undefined;
  /** Shown when no wallet is ready: preparing, funding, or none. */
  waiting: { text: string } | null;
}

export function Ticket({ perp, mark, wallet, state, waiting }: TicketProps) {
  const queries = useQueryClient();
  const [isLong, setLong] = useState(true);
  const [margin, setMargin] = useState("");
  const [leverage, setLeverage] = useState(Math.min(DEFAULT_LEVERAGE, perp.maxLeverage));
  const [limit, setLimit] = useState("");
  const [useLimit, setUseLimit] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });

  const available = state ? state.withdrawable + state.spotUsdc : 0;
  const marginUsd = Number(margin) || 0;
  const entry = useLimit ? (num(limit) ?? mark) : mark;
  const notional = marginUsd * leverage;
  const size = entry > 0 ? notional / entry : 0;
  const liq = notional > 0 ? liquidationPx(entry, leverage, perp.maxLeverage, isLong) : null;
  const fee = notional * TAKER_FEE;
  const problem = !wallet
    ? "No private wallet is ready"
    : marginUsd <= 0
      ? "Enter the margin to use"
      : marginUsd > available + EPSILON
        ? `Only ${usd(available)} is in this wallet`
        : notional < MIN_NOTIONAL_USD
          ? `Hyperliquid needs at least ${usd(MIN_NOTIONAL_USD, 0)} of position`
          : useLimit && !(num(limit) && Number(limit) > 0)
            ? "Enter a limit price"
            : null;

  async function place() {
    if (!wallet || problem) return;
    try {
      const account = await hlAccount(wallet);
      setStep({ kind: "working", what: "Moving the funding into the perp account" });
      await account.readyForPerps();
      setStep({ kind: "working", what: `Setting ${leverage}× leverage` });
      await account.setLeverage(perp, leverage, true);
      setStep({ kind: "working", what: "Signing with this wallet's key and sending privately" });
      const order = {
        perp,
        isBuy: isLong,
        size,
        ...(useLimit ? { limitPx: Number(limit) } : {}),
        ...(num(tp) ? { takeProfitPx: Number(tp) } : {}),
        ...(num(sl) ? { stopLossPx: Number(sl) } : {}),
      };
      const res = await account.order(order, mark);
      markTrading(wallet.id, `${isLong ? "Long" : "Short"} ${perp.name} ${leverage}×`);
      setStep({
        kind: "done",
        text:
          res.kind === "filled"
            ? `Filled ${res.size} ${perp.name} at ${price(res.avgPx)}`
            : `Limit order resting (#${res.oid})`,
      });
      void queries.invalidateQueries({ queryKey: ["hyperliquid", "account", wallet.id] });
    } catch (e) {
      setStep({ kind: "failed", text: e instanceof Error ? e.message : String(e) });
    }
  }

  const input = "rounded-lg border border-white/20 bg-transparent px-3 py-2 font-mono text-sm";
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-4">
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((long) => (
          <button
            key={String(long)}
            type="button"
            onClick={() => setLong(long)}
            className={`rounded-lg py-2 font-medium ${isLong === long ? (long ? "bg-emerald-500 text-black" : "bg-red-500 text-black") : "border border-white/20"}`}
          >
            {long ? "Long" : "Short"}
          </button>
        ))}
      </div>
      {wallet ? (
        <p className="text-xs opacity-70">
          From private wallet <span className="font-mono">{wallet.address.slice(0, ADDRESS_HEAD)}…</span> ·{" "}
          {usd(available)} free
        </p>
      ) : (
        <p className="text-amber-400 text-xs">
          {waiting?.text ?? "No private wallet is ready."}{" "}
          <Link href="/wallets" className="underline">
            Private wallets
          </Link>
        </p>
      )}
      <label className="flex flex-col gap-1 text-xs opacity-80">
        Margin (USDC)
        <input className={input} inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs opacity-80">
        Leverage: {leverage}× (max {perp.maxLeverage}×)
        <input
          type="range"
          min={1}
          max={perp.maxLeverage}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={useLimit} onChange={(e) => setUseLimit(e.target.checked)} />
        Limit price
      </label>
      {useLimit ? (
        <input className={input} placeholder={price(mark)} value={limit} onChange={(e) => setLimit(e.target.value)} />
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <input className={input} placeholder="Take profit" value={tp} onChange={(e) => setTp(e.target.value)} />
        <input className={input} placeholder="Stop loss" value={sl} onChange={(e) => setSl(e.target.value)} />
      </div>
      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        <dt className="opacity-60">Position</dt>
        <dd className="text-right font-mono">
          {usd(notional)} ≈ {size ? size.toPrecision(SIZE_SIG_DIGITS) : "0"} {perp.name}
        </dd>
        <dt className="opacity-60">Liquidation ≈</dt>
        <dd className="text-right font-mono">{liq ? price(liq) : "–"}</dd>
        <dt className="opacity-60">Hyperliquid fee ≈</dt>
        <dd className="text-right font-mono">{usd(fee)}</dd>
        <dt className="opacity-60">Mitoshi fee</dt>
        <dd className="text-right font-mono">none on trades</dd>
      </dl>
      <button
        type="button"
        disabled={Boolean(problem) || step.kind === "working"}
        onClick={() => void place()}
        className="rounded-lg bg-white py-2 font-medium text-black disabled:opacity-40"
      >
        {useLimit ? "Place limit order" : `${isLong ? "Long" : "Short"} at market`}
      </button>
      {problem && marginUsd > 0 ? <p className="text-amber-400 text-xs">{problem}</p> : null}
      {step.kind === "working" ? <p className="text-xs opacity-70">{step.what}…</p> : null}
      {step.kind === "done" ? <p className="text-emerald-400 text-xs">{step.text}</p> : null}
      {step.kind === "failed" ? <p className="text-red-400 text-xs">{step.text}</p> : null}
    </div>
  );
}
