"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Gauge, ShieldHalf } from "lucide-react";
import { useState } from "react";
import { cue, cx, Keypad, pressKey, Segmented, TxCta, type TxPhase } from "@/kit";
import { price, usd } from "../format";
import { DRIVERS } from "../perps/hooks";
import type { PerpAccount, PerpMarket } from "../perps/model";
import { openFund } from "../private-wallets/drawers";
import { recordTrade } from "../private-wallets/home";
import { EPSILON, MARGIN_DECIMALS, PCT, SHARES, SIZE_SIG } from "./constants";
import { ExitsSheet } from "./exits-sheet";
import { LeverageSheet } from "./leverage-sheet";
import { type Order, quoteOrder } from "./order";

/** Room after the typed digits, so the amount stays centred as it grows. */
const CARET_CH = 0.5;

type Outcome = { kind: "filled" | "resting" | "failed"; text: string } | null;

export interface TicketProps {
  market: PerpMarket;
  mark: number;
  wallet: PrivateWallet | undefined;
  account: PerpAccount | undefined;
  order: Order;
  setOrder: (patch: Partial<Order> | ((o: Order) => Partial<Order>)) => void;
  /** Phones: the amount uses the keypad. */
  keypad?: boolean;
  /** In the order sheet the side sits in the sheet's header. */
  sideInHeader?: boolean;
  onPlaced?: () => void;
}

function Chip({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 text-left hover:bg-surface-3"
    >
      <span className="text-muted">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[11px] text-muted">{label}</span>
        <span className="num truncate font-semibold text-[13px]">{value}</span>
      </span>
      <ChevronRight size={14} className="shrink-0 text-muted" />
    </button>
  );
}

/** Long or short from a private wallet: the amount first, leverage and exits in their own sheets, one line of numbers. */
export function Ticket({
  market,
  mark,
  wallet,
  account,
  order,
  setOrder,
  keypad = false,
  sideInHeader = false,
  onPlaced,
}: TicketProps) {
  const queries = useQueryClient();
  const driver = DRIVERS[market.venue];
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [step, setStep] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [sheet, setSheet] = useState<"leverage" | "exits" | null>(null);

  // What backs a cross-margin position: the account's equity, or before the first trade the funding still in spot.
  const equity = Math.max(account?.equity ?? 0, account?.free ?? 0);
  const q = quoteOrder(order, market, mark, equity);
  const free = account?.free ?? 0;
  const busy = phase === "signing" || phase === "sent";
  const problem = !wallet
    ? null
    : q.margin <= 0
      ? "Enter an amount"
      : q.margin > free + EPSILON
        ? `Only ${usd(free)} is free`
        : q.notional < market.minNotional
          ? `The smallest position is ${usd(market.minNotional, 0)}`
          : order.kind === "limit" && !(Number(order.limit) > 0)
            ? "Enter a limit price"
            : null;

  async function place() {
    if (!wallet || problem || busy) return;
    setOutcome(null);
    setPhase("signing");
    try {
      const res = await driver.place(
        wallet,
        {
          market,
          isBuy: q.isLong,
          size: q.size,
          leverage: order.leverage,
          ...(order.kind === "limit" ? { limitPx: Number(order.limit) } : {}),
          ...(q.tp ? { takeProfitPx: q.tp } : {}),
          ...(q.sl ? { stopLossPx: q.sl } : {}),
        },
        mark,
        (s) => {
          setStep(s);
          if (s.startsWith("Signing")) setPhase("sent");
        },
      );
      setPhase("confirmed");
      cue(res.kind === "filled" ? "fill" : "tap");
      const px = res.kind === "filled" ? res.avgPx : Number(order.limit);
      const size = res.kind === "filled" ? res.size : q.size;
      const side = q.isLong ? "Long" : "Short";
      recordTrade(wallet.id, {
        at: Date.now(),
        label: `${side} ${market.name} ${order.leverage}×${res.kind === "resting" ? " (limit)" : ""}`,
        asset: market.name,
        side: q.isLong ? "buy" : "sell",
        inAmount: String(size * px),
        outAmount: String(size),
        usd: res.kind === "filled" ? (size * px) / order.leverage : null,
        ref: String(res.oid),
      });
      setOutcome(
        res.kind === "filled"
          ? res.exitsMissing
            ? {
                kind: "failed",
                text: `${side} ${Number(size.toPrecision(SIZE_SIG))} ${market.name} at ${price(px)}, but TP/SL did not attach: watch it or close it`,
              }
            : { kind: "filled", text: `${side} ${Number(size.toPrecision(SIZE_SIG))} ${market.name} at ${price(px)}` }
          : { kind: "resting", text: `Limit resting at ${price(px)}` },
      );
      setOrder({ margin: "" });
      void queries.invalidateQueries({ queryKey: ["perps", market.venue, "account", wallet.id] });
      onPlaced?.();
    } catch (e) {
      setPhase("failed");
      cue("error");
      setOutcome({ kind: "failed", text: `${e instanceof Error ? e.message : String(e)}. No money moved.` });
    } finally {
      setStep("");
    }
  }

  const exits =
    q.tp || q.sl
      ? [q.tp ? `TP ${price(q.tp)}` : null, q.sl ? `SL ${price(q.sl)}` : null].filter(Boolean).join(" · ")
      : "Off";

  return (
    <div className="flex flex-col gap-3">
      {sideInHeader ? null : (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["long", "short"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setOrder({ side: s })}
              className={cx(
                "h-10 rounded-lg font-semibold capitalize transition-colors duration-[var(--dur-state)]",
                order.side === s ? (s === "long" ? "bg-up text-bg" : "bg-down text-bg") : "text-ink-2 hover:text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-1 py-1">
        <span className="flex w-full justify-between text-[12px] text-muted">
          <span>Margin</span>
          <span className="num">{usd(free)} free</span>
        </span>
        <label className="flex items-baseline justify-center gap-1">
          <span className="num font-semibold text-[40px] text-muted leading-none">$</span>
          <input
            inputMode={keypad ? "none" : "decimal"}
            readOnly={keypad}
            aria-label="Margin in USD"
            placeholder="0"
            value={order.margin}
            onChange={(e) => setOrder({ margin: e.target.value.replace(/[^\d.]/g, "") })}
            style={{ width: `${Math.max(1, order.margin.length || 1) + CARET_CH}ch` }}
            className="num max-w-[9ch] bg-transparent text-center font-semibold text-[48px] leading-none outline-none placeholder:text-muted"
          />
        </label>
        <span className="num text-[13px] text-ink-2">
          {q.notional > 0
            ? `${usd(q.notional)} · ${Number(q.size.toPrecision(SIZE_SIG))} ${market.name}`
            : `${order.leverage}× · ${market.name}`}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {SHARES.map((p) => (
          <button
            key={p}
            type="button"
            disabled={!free}
            onClick={() =>
              setOrder({ margin: (Math.floor(((free * p) / PCT) * PCT) / PCT || 0).toFixed(MARGIN_DECIMALS) })
            }
            className="h-8 rounded-full bg-surface-2 text-[12px] text-ink-2 hover:text-ink disabled:opacity-40"
          >
            {p === PCT ? "Max" : `${p}%`}
          </button>
        ))}
      </div>

      {keypad ? <Keypad onKey={(k) => setOrder((o) => ({ margin: pressKey(o.margin, k, MARGIN_DECIMALS) }))} /> : null}

      <div className="flex gap-2">
        <Chip
          icon={<Gauge size={16} />}
          label="Leverage"
          value={`${order.leverage}×`}
          onClick={() => setSheet("leverage")}
        />
        <Chip icon={<ShieldHalf size={16} />} label="TP / SL" value={exits} onClick={() => setSheet("exits")} />
      </div>

      <div className="flex items-center gap-2">
        <Segmented
          size="sm"
          value={order.kind}
          onChange={(kind) => setOrder({ kind })}
          options={[
            { value: "market", label: "Market" },
            { value: "limit", label: "Limit" },
          ]}
        />
        {order.kind === "limit" ? (
          <input
            inputMode="decimal"
            aria-label="Limit price"
            placeholder={price(mark)}
            value={order.limit}
            onChange={(e) => setOrder({ limit: e.target.value })}
            className="h-8 min-w-0 flex-1 rounded-full border border-hairline bg-surface-2 px-3 font-mono text-[13px] outline-none focus:border-strong"
          />
        ) : (
          <span className="num ml-auto text-[12px] text-muted">
            Liq {q.liquidation ? price(q.liquidation) : q.notional > 0 ? "none" : "–"} · fee {usd(q.fee)}
          </span>
        )}
      </div>

      <TxCta
        tone={q.isLong ? "up" : "down"}
        phase={phase === "confirmed" || phase === "failed" ? "idle" : phase}
        label={problem && q.margin > 0 ? problem : `${q.isLong ? "Long" : "Short"} ${market.name} · ${order.leverage}×`}
        onClick={() => void place()}
        {...(!wallet ? { fix: { label: "Fund a private wallet", onClick: () => openFund(driver.wallet) } } : {})}
      />
      {step ? <p className="text-center text-[12px] text-ink-2">{step}…</p> : null}
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

      <LeverageSheet
        open={sheet === "leverage"}
        onClose={() => setSheet(null)}
        market={market}
        value={order.leverage}
        entry={q.entry}
        isLong={q.isLong}
        margin={q.margin}
        equity={equity}
        onChange={(leverage) => setOrder({ leverage })}
      />
      <ExitsSheet
        open={sheet === "exits"}
        onClose={() => setSheet(null)}
        tp={order.tp}
        sl={order.sl}
        entry={q.entry}
        leverage={order.leverage}
        isLong={q.isLong}
        pnlAt={q.pnlAt}
        onChange={(tp, sl) => setOrder({ tp, sl })}
      />
    </div>
  );
}
