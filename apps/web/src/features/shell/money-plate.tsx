"use client";

import { ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { ZEC_NETWORK } from "@/constants";
import { CountdownRing, cx, RollingNumber, Skeleton } from "@/kit";
import { useZecUsd } from "../hyperliquid/hooks";
import { money, useWallet } from "../wallet/wallet-store";
import { MASK, useHideAmounts } from "./prefs";

const ZEC_DIGITS = 4;
const USD_DIGITS = 2;

/**
 * The rail's money plate: all your shielded ZEC (the same figure as Portfolio's ZEC line, spendable or not), what of it
 * is resting, and the network, on a cream card.
 */
export function MoneyPlate() {
  const w = useWallet();
  const [hidden, setHidden] = useHideAmounts();
  const b = w.summary?.balance;
  const m = money(b);
  const shielded = (m.spendable + m.resting + m.confirming + m.orchard) / ZAT_PER_ZEC;
  const resting = m.resting / ZAT_PER_ZEC;
  const zecUsd = useZecUsd();
  const syncing = w.progress;
  const test = ZEC_NETWORK !== "main";

  return (
    <div className="flex flex-col gap-2 rounded-[20px] bg-cream p-3.5 text-cream-ink">
      <div className="flex items-center justify-between">
        <span
          className={cx(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold text-[11px] tracking-[0.12em]",
            test ? "bg-accent text-accent-ink" : "bg-cream-ink text-cream",
          )}
        >
          {test ? "TESTNET" : "MAINNET"}
          <span className="font-stamp text-[12px] tracking-normal">{test ? "試" : "隠"}</span>
        </span>
        <button
          type="button"
          onClick={() => setHidden(!hidden)}
          aria-label={hidden ? "Show amounts" : "Hide amounts"}
          className="rounded-full p-1 text-cream-ink/60 hover:text-cream-ink"
        >
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {w.phase === "idle" || w.phase === "loading" ? (
        <Skeleton className="h-7 w-28 bg-cream-ink/10" label="Opening the wallet" />
      ) : w.phase === "empty" ? (
        <Link href="/wallet" className="font-semibold text-[15px] hover:underline">
          Create your private wallet →
        </Link>
      ) : w.phase === "error" ? (
        <Link href="/wallet" className="text-[13px] text-[#C2381F]">
          Wallet offline · open
        </Link>
      ) : (
        <Link href="/portfolio" className="flex flex-col">
          <span className="flex items-baseline gap-1.5">
            {hidden ? (
              <span className="num font-semibold text-[22px]">{MASK}</span>
            ) : (
              <RollingNumber
                value={shielded}
                format={{ maximumFractionDigits: ZEC_DIGITS, minimumFractionDigits: 2 }}
                className="font-semibold text-[22px] leading-tight"
              />
            )}
            <span className="font-semibold text-[13px] text-cream-ink/60">{test ? "TAZ" : "ZEC"}</span>
          </span>
          <span className="num text-[12px] text-cream-ink/60">
            {hidden || !zecUsd || test
              ? "shielded · private"
              : `≈ $${(shielded * zecUsd).toFixed(USD_DIGITS)} · shielded`}
          </span>
        </Link>
      )}
      {syncing && syncing.remainingBlocks > 0 ? (
        <span className="flex items-center gap-2 text-[12px] text-cream-ink/70">
          <CountdownRing
            fraction={
              1 -
              syncing.remainingBlocks /
                Math.max(syncing.remainingBlocks, syncing.tip - (w.summary?.birthday ?? syncing.tip) || 1)
            }
            size={16}
          />
          Syncing · {syncing.remainingBlocks.toLocaleString()} blocks
        </span>
      ) : resting > 0 ? (
        <span className="num flex items-center gap-1.5 text-[12px] text-cream-ink/70">
          <span className="size-1.5 rounded-full bg-[#F2994A]" />
          {hidden ? MASK : resting.toFixed(ZEC_DIGITS)} resting
        </span>
      ) : null}
    </div>
  );
}

/** The compact rail's stamp: the network, as one glyph. */
export function NetworkStamp() {
  const test = ZEC_NETWORK !== "main";
  return (
    <Link
      href="/portfolio"
      title={test ? "Testnet: test coins only" : "Mainnet"}
      className={cx(
        "flex size-10 items-center justify-center rounded-full font-stamp text-[17px]",
        test ? "bg-accent text-accent-ink" : "bg-cream text-cream-ink",
      )}
    >
      {test ? "試" : "隠"}
    </Link>
  );
}
