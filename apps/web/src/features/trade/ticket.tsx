"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import type { AccountState, Perp } from "@mitoshi/venues/hyperliquid";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cx, Segmented, TxCta, type TxPhase } from "@/kit";
import { price, usd } from "../format";
import { hlAccount } from "../hyperliquid/hl";
import { openFund } from "../private-wallets/drawers";
import { markTrading } from "../private-wallets/home";
import {
  DEFAULT_LEVERAGE,
  EPSILON,
  LEVERAGE_TICKS,
  MAINTENANCE_SHARE,
  MIN_NOTIONAL_USD,
  PCT,
  SHARES,
  SIZE_SIG,
  TAKER_FEE,
} from "./constants";

/** Approximate liquidation for a fresh cross position (maintenance = half the max-leverage margin). */
function liquidationPx(entry: number, leverage: number, maxLeverage: number, isLong: boolean): number {
  const mm = 1 / (MAINTENANCE_SHARE * maxLeverage);
  return isLong ? entry * (1 - 1 / leverage + mm) : entry * (1 + 1 / leverage - mm);
}

const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

type Outcome = { kind: "filled" | "resting" | "failed"; text: string } | null;

export interface TicketProps {
  perp: Perp;
  mark: number;
  wallet: PrivateWallet | undefined;
  state: AccountState | undefined;
}

/** Long or short from a private wallet, with leverage, TP/SL and a readout before you send. */
export function Ticket({ perp, mark, wallet, state }: TicketProps) {
  const queries = useQueryClient();
  const [side, setSide] = useState<"long" | "short">("long");
  const [margin, setMargin] = useState("");
  const [leverage, setLeverage] = useState(Math.min(DEFAULT_LEVERAGE, perp.maxLeverage));
  const [kind, setKind] = useState<"market" | "limit">("market");
  const [limit, setLimit] = useState("");
  const [exits, setExits] = useState(false);
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [step, setStep] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);

  const isLong = side === "long";
  const available = state ? state.withdrawable + state.spotUsdc : 0;
  const marginUsd = Number(margin) || 0;
  const entry = kind === "limit" ? (num(limit) ?? mark) : mark;
  const notional = marginUsd * leverage;
  const size = entry > 0 ? notional / entry : 0;
  const liq = notional > 0 ? liquidationPx(entry, leverage, perp.maxLeverage, isLong) : null;
  const ticks = LEVERAGE_TICKS.filter((t) => t <= perp.maxLeverage);

  const problem = !wallet
    ? null
    : marginUsd <= 0
      ? "Enter your margin"
      : marginUsd > available + EPSILON
        ? `Only ${usd(available)} is free in this wallet`
        : notional < MIN_NOTIONAL_USD
          ? `Hyperliquid's minimum position is ${usd(MIN_NOTIONAL_USD, 0)}`
          : kind === "limit" && !(Number(limit) > 0)
            ? "Enter a limit price"
            : null;

  async function place() {
    if (!wallet || problem) return;
    setOutcome(null);
    try {
      const account = await hlAccount(wallet);
      setPhase("signing");
      setStep("Moving the funding into the perp account");
      await account.readyForPerps();
      setStep(`Setting ${leverage}× leverage`);
      await account.setLeverage(perp, leverage, true);
      setStep("Signing with this wallet's own key");
      const order = {
        perp,
        isBuy: isLong,
        size,
        ...(kind === "limit" ? { limitPx: Number(limit) } : {}),
        ...(exits && num(tp) ? { takeProfitPx: Number(tp) } : {}),
        ...(exits && num(sl) ? { stopLossPx: Number(sl) } : {}),
      };
      setPhase("sent");
      setStep("Sent privately to Hyperliquid");
      const res = await account.order(order, mark);
      setPhase("confirmed");
      markTrading(wallet.id, `${isLong ? "Long" : "Short"} ${perp.name} ${leverage}×`);
      setOutcome(
        res.kind === "filled"
          ? {
              kind: "filled",
              text: `${isLong ? "Long" : "Short"} ${res.size} ${perp.name} filled at ${price(res.avgPx)}`,
            }
          : { kind: "resting", text: `Limit order resting at ${price(Number(limit))}` },
      );
      setMargin("");
      void queries.invalidateQueries({ queryKey: ["hyperliquid", "account", wallet.id] });
    } catch (e) {
      setPhase("failed");
      setOutcome({ kind: "failed", text: `${e instanceof Error ? e.message : String(e)}. No money moved.` });
    } finally {
      setStep("");
    }
  }

  const input =
    "h-11 w-full rounded-lg border border-hairline bg-surface-1 px-3 font-mono text-[15px] outline-none focus:border-strong";
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-1 p-1">
        {(["long", "short"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cx(
              "h-10 rounded-md font-semibold capitalize transition-colors duration-[var(--dur-state)]",
              side === s ? (s === "long" ? "bg-up text-bg" : "bg-down text-bg") : "text-ink-2 hover:text-ink",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <Segmented
        size="sm"
        value={kind}
        onChange={setKind}
        options={[
          { value: "market", label: "Market" },
          { value: "limit", label: "Limit" },
        ]}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="type-label text-muted">Margin</span>
          <span className="num text-ink-2">{usd(available)} free</span>
        </div>
        <div className="relative">
          <input
            className={input}
            inputMode="decimal"
            placeholder="0.00"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">USDC</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SHARES.map((p) => (
            <button
              key={p}
              type="button"
              disabled={!available}
              onClick={() => setMargin((Math.floor(available * p) / PCT || 0).toFixed(2))}
              className="h-7 rounded-full bg-surface-1 text-[12px] text-ink-2 hover:text-ink disabled:opacity-40"
            >
              {p === PCT ? "Max" : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      {kind === "limit" ? (
        <div className="flex flex-col gap-2">
          <span className="type-label text-muted">Limit price</span>
          <input
            className={input}
            inputMode="decimal"
            placeholder={price(mark)}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="type-label text-muted">Leverage</span>
          <span className="num font-semibold text-sm">{leverage}×</span>
        </div>
        <input
          type="range"
          min={1}
          max={perp.maxLeverage}
          value={leverage}
          onChange={(e) => setLeverage(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between">
          {ticks.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLeverage(t)}
              className="num text-[11px] text-muted hover:text-ink"
            >
              {t}×
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between text-[13px]">
        <span>Take profit / stop loss</span>
        <input
          type="checkbox"
          checked={exits}
          onChange={(e) => setExits(e.target.checked)}
          className="size-4 accent-[var(--accent)]"
        />
      </label>
      {exits ? (
        <div className="grid grid-cols-2 gap-2">
          <input
            className={cx(input, "text-up")}
            placeholder="TP price"
            inputMode="decimal"
            value={tp}
            onChange={(e) => setTp(e.target.value)}
          />
          <input
            className={cx(input, "text-down")}
            placeholder="SL price"
            inputMode="decimal"
            value={sl}
            onChange={(e) => setSl(e.target.value)}
          />
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-surface-1 p-3 text-[13px]">
        <dt className="text-ink-2">Position</dt>
        <dd className="num text-right">
          {usd(notional)} · {size ? size.toPrecision(SIZE_SIG) : "0"} {perp.name}
        </dd>
        <dt className="text-ink-2">Entry ≈</dt>
        <dd className="num text-right">{price(entry)}</dd>
        <dt className="text-ink-2">Liquidation ≈</dt>
        <dd className="num text-right text-warning">{liq ? price(liq) : "–"}</dd>
        <dt className="text-ink-2">Hyperliquid fee ≈</dt>
        <dd className="num text-right">{usd(notional * TAKER_FEE)}</dd>
        <dt className="text-ink-2">Mitoshi fee</dt>
        <dd className="text-right">none on trades</dd>
      </dl>

      <TxCta
        tone={isLong ? "up" : "down"}
        phase={phase === "confirmed" || phase === "failed" ? "idle" : phase}
        label={kind === "limit" ? `Place ${side} limit` : `${isLong ? "Long" : "Short"} ${perp.name} · ${leverage}×`}
        onClick={() => void place()}
        {...(!wallet ? { fix: { label: "Fund a private wallet first", onClick: () => openFund("hyperliquid") } } : {})}
      />
      {step ? <p className="text-center text-[12px] text-ink-2">{step}…</p> : null}
      {problem && marginUsd > 0 ? <p className="text-center text-[12px] text-warning">{problem}</p> : null}
      {outcome ? (
        <p
          className={cx(
            "rounded-lg px-3 py-2 text-center text-[13px]",
            outcome.kind === "failed" ? "bg-down-wash text-down" : "bg-up-wash text-up",
          )}
        >
          {outcome.text}
        </p>
      ) : null}
    </div>
  );
}
