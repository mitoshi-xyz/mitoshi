"use client";

import { latestSwap, type PrivateWallet } from "@mitoshi/engine";
import type { AccountState } from "@mitoshi/venues/hyperliquid";
import { ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CountdownRing, cx, Skeleton } from "@/kit";
import { usd } from "../format";
import { VenueMark } from "../marks/mark";
import { MASK, useHideAmounts } from "../shell/prefs";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const TICK_MS = 1000;
const ADDRESS_HEAD = 6;
const ADDRESS_TAIL = 4;

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}

const short = (a: string) => `${a.slice(0, ADDRESS_HEAD)}…${a.slice(-ADDRESS_TAIL)}`;

/**
 * Which private wallet this terminal trades from, and its state: none yet (and how to get one), preparing, funding
 * (ring and live ETA), ready or trading (its balance). One wallet per position: nobody can link two of them.
 */
export function WalletCard({
  wallet,
  pending,
  state,
  loading,
}: {
  wallet: PrivateWallet | undefined;
  pending: PrivateWallet | undefined;
  state: AccountState | undefined;
  loading: boolean;
}) {
  const now = useNow();
  const [hidden] = useHideAmounts();

  if (wallet) {
    const free = state ? state.withdrawable + state.spotUsdc : 0;
    return (
      <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-1 p-3">
        <span className="relative">
          <VenueMark venue="hyperliquid" size={34} />
          <ShieldCheck size={14} className="absolute -right-1 -bottom-1 rounded-full bg-bg text-up" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-[12px] text-muted">
            Private wallet · <span className="font-mono">{short(wallet.address)}</span>
          </span>
          {loading && !state ? (
            <Skeleton className="mt-1 h-5 w-24" />
          ) : (
            <span className="num font-semibold text-[17px]">{hidden ? MASK : usd(free)}</span>
          )}
        </span>
        <span
          className={cx(
            "rounded-full px-2 py-0.5 font-medium text-[11px]",
            wallet.status === "trading" ? "bg-accent-wash text-accent" : "bg-up-wash text-up",
          )}
        >
          {wallet.status === "trading" ? "Trading" : "Ready"}
        </span>
      </div>
    );
  }

  if (pending) {
    const swap = latestSwap(pending, "fund");
    const total = (swap?.timeEstimateSeconds ?? 0) * MS_PER_SECOND;
    const left = swap ? Math.max(0, swap.createdAt + total - now) : Math.max(0, (pending.fundAt ?? now) - now);
    const fraction = swap && total > 0 ? 1 - left / total : 0;
    const minutes = Math.max(1, Math.round(left / MS_PER_SECOND / SECONDS_PER_MINUTE));
    return (
      <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent-wash p-3">
        <CountdownRing fraction={fraction} size={34} />
        <span className="flex flex-col leading-tight">
          <span className="font-medium text-sm">
            {swap ? "Funding your private wallet" : "Preparing your private wallet"}
          </span>
          <span className="text-[12px] text-ink-2">
            {swap ? `Swapping on NEAR · about ${minutes} min` : `Starts in about ${minutes} min, at a random moment`}
          </span>
        </span>
      </div>
    );
  }

  return (
    <Link
      href="/wallets"
      className="flex items-center gap-3 rounded-lg border border-dashed border-strong p-3 transition-colors hover:border-accent hover:bg-accent-wash"
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-ink">
        <Sparkles size={17} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="font-medium text-sm">Fund a private wallet</span>
        <span className="text-[12px] text-ink-2">
          A brand-new Hyperliquid account from your shielded ZEC, in ~8 min.
        </span>
      </span>
    </Link>
  );
}
