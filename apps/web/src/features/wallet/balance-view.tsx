"use client";

import { ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ArrowDownToLine, ArrowUpFromLine, Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { Button, CountdownRing, RollingNumber } from "@/kit";
import { usd } from "../format";
import { useLiveMids } from "../hyperliquid/hooks";
import { Mark } from "../marks/mark";
import { useRegistry } from "../private-wallets/registry-store";
import { MASK, useHideAmounts } from "../shell/prefs";
import { DepositDrawer } from "./deposit-drawer";
import { History } from "./history";
import { SyncStrip } from "./sync-strip";
import type { WalletState } from "./wallet-store";
import { WithdrawDrawer } from "./withdraw-drawer";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 4;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

function inWords(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function Pocket({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-black/25 p-3">
      <span className="flex items-center gap-1.5 text-[12px] text-cream/60">
        {children}
        {label}
      </span>
      <span className="num font-semibold text-[16px] text-cream">{value}</span>
      {hint ? <span className="text-[11px] text-cream/50">{hint}</span> : null}
    </div>
  );
}

/** Balance: your shielded ZEC, where each part of it is, the way in and out, and what happened. */
export function BalanceView({ state }: { state: WalletState }) {
  const mids = useLiveMids();
  const registry = useRegistry();
  const [hidden, setHidden] = useHideAmounts();
  const [deposit, setDeposit] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const b = state.summary?.balance;
  const spendable = b ? b.ironwood.spendable + b.orchard.spendable : 0;
  const resting = b ? b.ironwood.locked + b.orchard.locked : 0;
  const pending = b ? Math.max(0, b.total - spendable - resting) : 0;
  const inWallets = registry.wallets
    .filter((w) => ["funding", "ready", "trading", "returning"].includes(w.status))
    .reduce((n, w) => n + w.sizeZat, 0);
  const zecUsd = ZEC_NETWORK === "main" ? mids.ZEC : undefined;
  const total = spendable / ZAT_PER_ZEC;
  const show = (zat: number) => (hidden ? MASK : `${(zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS)} ${UNIT}`);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="type-headline-lg">Balance</h1>
        <p className="text-ink-2">
          Shielded ZEC that lives only in this browser. Nobody else, Mitoshi included, can see it.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-[#141210] p-6 text-cream">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-10 select-none font-stamp text-[180px] text-cream/[0.04] leading-none"
        >
          隠
        </span>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-[13px] text-cream/60">
              <Mark symbol="ZEC" size={18} /> Shielded {UNIT} · spendable
            </span>
            {hidden ? (
              <span className="num font-semibold text-[44px] leading-tight">{MASK}</span>
            ) : (
              <span className="flex items-baseline gap-2">
                <RollingNumber
                  value={total}
                  format={{ minimumFractionDigits: 2, maximumFractionDigits: ZEC_DIGITS }}
                  className="font-semibold text-[44px] leading-tight"
                />
                <span className="font-semibold text-[18px] text-cream/60">{UNIT}</span>
              </span>
            )}
            <span className="num text-[13px] text-cream/60">
              {hidden ? "" : zecUsd ? `≈ ${usd(total * zecUsd)}` : "test coins · no value"}
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
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Pocket
            label="Resting"
            value={show(resting)}
            hint={
              resting > 0 && state.restingUntil
                ? `usable in ${inWords(state.restingUntil - Date.now())}`
                : "from public addresses"
            }
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
          <Pocket label="Confirming" value={show(pending)} hint="arriving now" />
          <Pocket
            label="In private wallets"
            value={show(inWallets)}
            hint={`${registry.wallets.filter((w) => w.status === "ready" || w.status === "trading").length} live`}
          />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button tone="primary" size="lg" icon={<ArrowDownToLine size={17} />} onClick={() => setDeposit(true)}>
            Deposit
          </Button>
          <button
            type="button"
            onClick={() => setWithdraw(true)}
            className="inline-flex h-12 items-center gap-2 rounded-md bg-cream px-5 font-semibold text-[15px] text-cream-ink hover:brightness-95"
          >
            <ArrowUpFromLine size={17} /> Withdraw
          </button>
          <Link
            href="/wallets"
            className="inline-flex h-12 items-center gap-2 rounded-md border border-cream/20 px-5 font-semibold text-[15px] hover:bg-cream/10"
          >
            <Sparkles size={17} /> Fund a private wallet
          </Link>
        </div>
      </div>

      <SyncStrip state={state} />

      <section className="flex flex-col gap-3">
        <h2 className="type-title">History</h2>
        <History entries={state.history} tip={state.summary?.tip ?? null} />
      </section>

      <DepositDrawer open={deposit} onClose={() => setDeposit(false)} />
      <WithdrawDrawer open={withdraw} onClose={() => setWithdraw(false)} />
    </section>
  );
}
