"use client";

import { type HistoryEntry, ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Eye, EyeOff, ListChecks, Plus } from "lucide-react";
import { ZEC_NETWORK } from "@/constants";
import { CountdownRing, cx, RollingNumber } from "@/kit";
import { usd } from "../format";
import { useLiveMids } from "../hyperliquid/hooks";
import { openJudgePath } from "../judge/desk-sheet";
import { useJudgeDesk } from "../judge/judge";
import { Mark } from "../marks/mark";
import { openDeposit, openFund, openWithdraw } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { MASK, useHideAmounts } from "../shell/prefs";
import { OrchardMove } from "../wallet/orchard-move";
import { openReceipt } from "../wallet/receipt";
import { arriving, progress } from "../wallet/tx";
import { money, type WalletState } from "../wallet/wallet-store";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 4;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const LIVE_WALLETS = ["funding", "ready", "trading", "returning"];

/** A rest's time left in a pocket's width: "1h 30m", "12m". */
function short(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function Pocket({
  label,
  value,
  note,
  children,
}: {
  label: string;
  value: string;
  /** A short line under the value (how long a rest has left). */
  note?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-black/25 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] text-cream/60">
        {children}
        {label}
      </span>
      <span className="num font-semibold text-[14px] text-cream">{value}</span>
      {note ? <span className="num truncate text-[11px] text-cream/60">{note}</span> : null}
    </div>
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
  const what = `${hidden ? MASK : (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "")} confirming`;
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

/** Your shielded ZEC: what is spendable, what rests or confirms, what is out in private wallets, and the ways in and out. */
export function MoneyCard({ state }: { state: WalletState }) {
  const mids = useLiveMids();
  const registry = useRegistry();
  const desk = useJudgeDesk();
  const [hidden, setHidden] = useHideAmounts();
  const b = state.summary?.balance;
  const { spendable, resting, orchard, confirming: pending } = money(b);
  const inWallets = registry.wallets.filter((w) => LIVE_WALLETS.includes(w.status)).reduce((n, w) => n + w.sizeZat, 0);
  const zecUsd = ZEC_NETWORK === "main" ? mids.ZEC : undefined;
  // Everything in the shielded wallet, spendable or not: what isn't yet is said under it (and dims the figure).
  const total = (spendable + resting + orchard + pending) / ZAT_PER_ZEC;
  const waiting = spendable === 0 && total > 0;
  const tip = state.summary?.tip ?? null;
  const incoming = pending > 0 ? state.history.find((e) => arriving(e, tip)) : undefined;
  const show = (zat: number) => (hidden ? MASK : `${(zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS)}`);

  return (
    <div className="relative overflow-hidden rounded-xl bg-[#141210] p-5 text-cream md:p-6">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -bottom-10 select-none font-stamp text-[180px] text-cream/[0.04] leading-none"
      >
        隠
      </span>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-[13px] text-cream/60">
            <Mark symbol="ZEC" size={18} /> Shielded {UNIT}
          </span>
          {hidden ? (
            <span className="num font-semibold text-[40px] leading-tight">{MASK}</span>
          ) : (
            <span className="flex items-baseline gap-2">
              <RollingNumber
                value={total}
                format={{ minimumFractionDigits: 2, maximumFractionDigits: ZEC_DIGITS }}
                className={cx("font-semibold text-[40px] leading-tight", waiting && "text-cream/55")}
              />
              <span className="font-semibold text-[18px] text-cream/60">{UNIT}</span>
            </span>
          )}
          <span className="num text-[13px] text-cream/60">
            {hidden ? "" : ZEC_NETWORK !== "main" ? "test coins" : zecUsd ? `≈ ${usd(total * zecUsd)}` : " "}
          </span>
        </div>
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
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Pocket label="Spendable" value={show(spendable)} />
        <Pocket
          label="Resting"
          value={show(resting)}
          {...(resting > 0 && state.restingUntil ? { note: short(state.restingUntil - Date.now()) } : {})}
        >
          {resting > 0 && state.restingUntil && state.restingFrom ? (
            <CountdownRing
              fraction={Math.max(
                0,
                Math.min(1, (state.restingUntil - Date.now()) / Math.max(1, state.restingUntil - state.restingFrom)),
              )}
              size={12}
            />
          ) : null}
        </Pocket>
        <Pocket label="In wallets" value={show(inWallets)} />
      </div>
      <OrchardMove orchardZat={orchard} hidden={hidden} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(
          [
            // A desk takes no deposits (its money is the judges'): its first button is the judge's path.
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
  );
}
