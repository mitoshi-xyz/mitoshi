"use client";

import { ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ArrowDownToLine, ArrowUpFromLine, Eye, EyeOff, Plus } from "lucide-react";
import { ZEC_NETWORK } from "@/constants";
import { CountdownRing, RollingNumber } from "@/kit";
import { usd } from "../format";
import { useLiveMids } from "../hyperliquid/hooks";
import { Mark } from "../marks/mark";
import { openDeposit, openFund, openWithdraw } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { MASK, useHideAmounts } from "../shell/prefs";
import type { WalletState } from "../wallet/wallet-store";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 4;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const LIVE_WALLETS = ["funding", "ready", "trading", "returning"];

function inWords(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function Pocket({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-black/25 px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] text-cream/60">
        {children}
        {label}
      </span>
      <span className="num font-semibold text-[14px] text-cream">{value}</span>
    </div>
  );
}

/** Your shielded ZEC: what is spendable, what rests or confirms, what is out in private wallets, and the ways in and out. */
export function MoneyCard({ state }: { state: WalletState }) {
  const mids = useLiveMids();
  const registry = useRegistry();
  const [hidden, setHidden] = useHideAmounts();
  const b = state.summary?.balance;
  const spendable = b ? b.ironwood.spendable + b.orchard.spendable : 0;
  const resting = b ? b.ironwood.locked + b.orchard.locked : 0;
  const pending = b ? Math.max(0, b.total - spendable - resting) : 0;
  const inWallets = registry.wallets.filter((w) => LIVE_WALLETS.includes(w.status)).reduce((n, w) => n + w.sizeZat, 0);
  const zecUsd = ZEC_NETWORK === "main" ? mids.ZEC : undefined;
  const total = spendable / ZAT_PER_ZEC;
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
                className="font-semibold text-[40px] leading-tight"
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
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Pocket
          label={
            resting > 0 && state.restingUntil ? `Resting · ${inWords(state.restingUntil - Date.now())}` : "Resting"
          }
          value={show(resting)}
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
        <Pocket label="Confirming" value={show(pending)} />
        <Pocket label="In wallets" value={show(inWallets)} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(
          [
            { label: "Deposit", icon: ArrowDownToLine, onClick: openDeposit, tone: "bg-accent text-accent-ink" },
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
