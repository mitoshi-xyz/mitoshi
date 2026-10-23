"use client";

import { latestSwap, type PrivateWallet, type Venue } from "@mitoshi/engine";
import { Plus } from "lucide-react";
import { CountdownRing, cx, Skeleton } from "@/kit";
import { VenueMark } from "../marks/mark";
import { MASK, useHideAmounts } from "../shell/prefs";
import { openFund } from "./drawers";
import { useNow } from "./use-now";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const VENUE_MARK = { hyperliquid: "hyperliquid", polymarket: "polymarket", solana: "solana" } as const;

/**
 * The private wallet a screen trades from, as one chip: its venue and what it holds, the funding ring while one is on
 * its way, or "Fund" when there is none. One wallet per position, so nobody can link two of them.
 */
export function WalletChip({
  venue,
  wallet,
  pending,
  value,
  loading,
  className,
}: {
  venue: Venue;
  wallet: PrivateWallet | undefined;
  pending: PrivateWallet | undefined;
  /** What the wallet holds, formatted ("$12.40", "0.0812 SOL"). */
  value: string | undefined;
  loading: boolean;
  className?: string;
}) {
  const now = useNow();
  const [hidden] = useHideAmounts();
  const base = "flex h-11 shrink-0 items-center gap-2 rounded-full border pr-3.5 pl-1.5 backdrop-blur";

  if (wallet) {
    return (
      <span className={cx(base, "border-hairline bg-surface-1/85", className)}>
        <VenueMark venue={VENUE_MARK[venue]} size={30} />
        {loading && value === undefined ? (
          <Skeleton className="h-4 w-14" />
        ) : (
          <span className="num font-semibold text-[14px]">{hidden ? MASK : (value ?? "–")}</span>
        )}
      </span>
    );
  }

  if (pending) {
    const swap = latestSwap(pending, "fund");
    const total = (swap?.timeEstimateSeconds ?? 0) * MS_PER_SECOND;
    const left = swap ? Math.max(0, swap.createdAt + total - now) : Math.max(0, (pending.fundAt ?? now) - now);
    const minutes = Math.max(1, Math.round(left / MS_PER_SECOND / SECONDS_PER_MINUTE));
    return (
      <span className={cx(base, "border-accent/40 bg-accent-wash", className)}>
        <CountdownRing fraction={swap && total > 0 ? 1 - left / total : 0} size={30} />
        <span className="num font-medium text-[13px]">{minutes} min</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openFund(venue)}
      className={cx(base, "border-hairline bg-surface-1/85 hover:border-accent", className)}
    >
      <span className="relative">
        <VenueMark venue={VENUE_MARK[venue]} size={30} />
        <Plus
          size={12}
          strokeWidth={3}
          className="absolute -right-1 -bottom-1 rounded-full bg-accent p-0.5 text-accent-ink"
        />
      </span>
      <span className="font-semibold text-[13px]">Fund</span>
    </button>
  );
}
