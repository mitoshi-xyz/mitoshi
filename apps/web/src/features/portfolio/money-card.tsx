"use client";

import { type HistoryEntry, ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Eye, EyeOff, ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { cx, Drawer, RollingNumber } from "@/kit";
import { usd } from "../format";
import { openJudgePath } from "../judge/desk-sheet";
import { useJudgeDesk } from "../judge/judge";
import { Mark } from "../marks/mark";
import { openDeposit, openFund, openWithdraw } from "../private-wallets/drawers";
import { MASK, useHideAmounts } from "../shell/prefs";
import { OrchardMove } from "../wallet/orchard-move";
import { openReceipt } from "../wallet/receipt";
import { arriving, progress } from "../wallet/tx";
import { money, type WalletState } from "../wallet/wallet-store";
import type { PortfolioView } from "./totals";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 4;
const PCT = 100;

const zecText = (v: number) => v.toFixed(ZEC_DIGITS).replace(/\.?0+$/, "") || "0";

/** A signed dollar change in its colour; a dash when it isn't known. */
export function Signed({ v, hidden, className }: { v: number | null; hidden: boolean; className?: string }) {
  if (v === null) return <span className={cx("text-muted", className)}>–</span>;
  if (hidden) return <span className={className}>{MASK}</span>;
  return (
    <span className={cx(v >= 0 ? "text-up" : "text-down", className)}>
      {v >= 0 ? "+" : "−"}
      {usd(Math.abs(v))}
    </span>
  );
}

/** ZEC on its way in, counted block by block; it opens the transaction's receipt. */
function Confirming({
  zat,
  hidden,
  entry,
  tip,
}: {
  zat: number;
  hidden: boolean;
  entry: HistoryEntry | undefined;
  tip: number | null;
}) {
  const p = entry ? progress(entry, tip) : null;
  const what = `${hidden ? MASK : zecText(zat / ZAT_PER_ZEC)} ${UNIT} confirming`;
  const count = entry && p ? (entry.minedHeight === null ? "next block" : `${p.done}/${p.need}`) : null;
  const body = (
    <>
      <span className="relative flex size-2 shrink-0">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative size-2 rounded-full bg-accent" />
      </span>
      <span className="num min-w-0 flex-1 truncate">{what}</span>
      {count && p ? (
        <span className="num shrink-0 text-cream/60">
          {count} · {p.minutesLeft} min
        </span>
      ) : null}
      {entry ? <ChevronRight size={14} className="shrink-0 text-cream/50" /> : null}
    </>
  );
  const pill =
    "mt-3 flex w-full items-center gap-2 rounded-full bg-accent/15 px-3 py-2 text-left text-[12px] text-cream";
  return entry ? (
    <button type="button" onClick={() => openReceipt(entry.txid)} className={cx(pill, "hover:bg-accent/25")}>
      {body}
    </button>
  ) : (
    <div className={pill}>{body}</div>
  );
}

function Share({
  label,
  value,
  of,
  hidden,
  children,
}: {
  label: string;
  value: number | null;
  of: number | null;
  hidden: boolean;
  children?: React.ReactNode;
}) {
  const share = value !== null && of ? Math.max(0, Math.min(1, value / of)) : 0;
  return (
    <li className="flex flex-col gap-1.5 py-3">
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-[14px]">{label}</span>
        <span className="num font-semibold text-[14px]">
          {hidden ? MASK : value === null ? "–" : usd(value)}
          <span className="ml-2 font-normal text-[12px] text-muted">{Math.round(share * PCT)}%</span>
        </span>
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-accent" style={{ width: `${share * PCT}%` }} />
      </span>
      {children ? <span className="num text-[12px] text-muted">{children}</span> : null}
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="num font-semibold text-[14px]">{children}</span>
    </div>
  );
}

/** What the total is made of: shielded ZEC, cash on the venues, tokens, positions; then the results. */
function Breakdown({ open, onClose, p }: { open: boolean; onClose: () => void; p: PortfolioView }) {
  const [hidden] = useHideAmounts();
  const z = p.zec;
  const pockets = [
    z.spendable > 0 ? `${zecText(z.spendable)} spendable` : null,
    z.resting > 0 ? `${zecText(z.resting)} resting` : null,
    z.confirming > 0 ? `${zecText(z.confirming)} confirming` : null,
    z.orchard > 0 ? `${zecText(z.orchard)} in Orchard` : null,
  ].filter(Boolean);
  return (
    <Drawer open={open} onClose={onClose} title="Your balance">
      <ul className="flex flex-col divide-y divide-[var(--hairline)]">
        <Share label="Shielded ZEC" value={p.shieldedUsd} of={p.totalUsd} hidden={hidden}>
          {hidden ? MASK : `${zecText(z.total)} ${UNIT}${pockets.length ? ` · ${pockets.join(" · ")}` : ""}`}
        </Share>
        <Share label="Cash on venues" value={p.cashUsd} of={p.totalUsd} hidden={hidden} />
        {p.tokensUsd > 0 ? <Share label="Tokens" value={p.tokensUsd} of={p.totalUsd} hidden={hidden} /> : null}
        <Share label="In positions" value={p.positionsUsd} of={p.totalUsd} hidden={hidden}>
          {p.openPnlUsd === null ? null : (
            <>
              Open P&L <Signed v={p.openPnlUsd} hidden={hidden} />
            </>
          )}
        </Share>
      </ul>
      <div className="grid grid-cols-3 gap-2">
        <Fact label="Today">
          <Signed v={p.dayUsd} hidden={hidden} />
        </Fact>
        <Fact label="All-time">
          <Signed v={p.allTimeUsd} hidden={hidden} />
        </Fact>
        <Fact label="Swap costs">{hidden ? MASK : usd(p.swapCostUsd)}</Fact>
      </div>
    </Drawer>
  );
}

/**
 * The balance: one figure for everything (the shielded ZEC at the live price plus every private wallet's cash,
 * tokens and positions), moving with the market, today's change under it, and the ways in and out. Tapping the
 * figure shows what it is made of.
 */
export function MoneyCard({ state, p }: { state: WalletState; p: PortfolioView }) {
  const desk = useJudgeDesk();
  const [hidden, setHidden] = useHideAmounts();
  const [breakdown, setBreakdown] = useState(false);
  const { confirming: pending, orchard } = money(state.summary?.balance);
  const tip = state.summary?.tip ?? null;
  const incoming = pending > 0 ? state.history.find((e) => arriving(e, tip)) : undefined;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl bg-[#141210] p-5 text-cream md:p-6">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-10 select-none font-stamp text-[180px] text-cream/[0.04] leading-none"
        >
          隠
        </span>
        <div className="flex items-start justify-between gap-4">
          <button
            type="button"
            onClick={() => setBreakdown(true)}
            aria-label="What your balance is made of"
            className="group flex min-w-0 flex-col items-start gap-1 text-left"
          >
            <span className="flex items-center gap-1 text-[13px] text-cream/60">
              Total balance
              <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
            {hidden ? (
              <span className="num font-semibold text-[40px] leading-tight">{MASK}</span>
            ) : p.totalUsd === null ? (
              <span className="flex items-baseline gap-2">
                <RollingNumber
                  value={p.zec.total}
                  format={{ minimumFractionDigits: 2, maximumFractionDigits: ZEC_DIGITS }}
                  className="font-semibold text-[40px] leading-tight"
                />
                <span className="font-semibold text-[18px] text-cream/60">{UNIT}</span>
              </span>
            ) : (
              <RollingNumber
                value={p.totalUsd}
                format={{ style: "currency", currency: "USD" }}
                className={cx("font-semibold text-[40px] leading-tight", p.loading && "text-cream/55")}
              />
            )}
            <span className="num flex items-center gap-1.5 text-[13px] text-cream/60">
              {p.dayUsd !== null && p.totalUsd !== null ? (
                <>
                  <Signed v={p.dayUsd} hidden={hidden} /> today
                </>
              ) : ZEC_NETWORK !== "main" ? (
                "test coins"
              ) : (
                <>
                  <Mark symbol="ZEC" size={14} /> {hidden ? MASK : `${zecText(p.zec.total)} ${UNIT} shielded`}
                </>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            aria-label={hidden ? "Show amounts" : "Hide amounts"}
            className="rounded-full p-2 text-cream/60 hover:bg-cream/10 hover:text-cream"
          >
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {pending > 0 ? <Confirming zat={pending} hidden={hidden} entry={incoming} tip={tip} /> : null}
        <OrchardMove orchardZat={orchard} hidden={hidden} />
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(
            [
              // The judges' wallet takes no deposits (its money is theirs to try): its first button is their path.
              desk === null
                ? { label: "Deposit", icon: ArrowDownToLine, onClick: openDeposit, tone: "bg-accent text-accent-ink" }
                : { label: "Judge path", icon: ListChecks, onClick: openJudgePath, tone: "bg-accent text-accent-ink" },
              { label: "Withdraw", icon: ArrowUpFromLine, onClick: openWithdraw, tone: "bg-cream text-cream-ink" },
              { label: "Wallet", icon: Plus, onClick: () => openFund(), tone: "border border-cream/20 text-cream" },
            ] as const
          ).map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={`flex h-16 flex-col items-center justify-center gap-1 rounded-lg font-semibold text-[13px] hover:brightness-105 ${a.tone}`}
            >
              <a.icon size={18} />
              {a.label}
            </button>
          ))}
        </div>
      </div>
      <Breakdown open={breakdown} onClose={() => setBreakdown(false)} p={p} />
    </>
  );
}
