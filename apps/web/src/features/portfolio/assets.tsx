"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cx, Skeleton } from "@/kit";
import { usd } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { MASK, useHideAmounts } from "../shell/prefs";
import type { WalletState } from "../wallet/wallet-store";
import { Signed } from "./money-card";
import type { Asset, PortfolioView } from "./totals";

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const STABLE_DIGITS = 2;
const AMOUNT_SIG = 6;
const ZEC_DIGITS = 4;

/** A rest's time left in a row's width: "1h 30m", "12m". */
function short(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function amountText(a: Asset): string {
  const stable = a.unit === "USDC" || a.unit === "pUSD";
  const n = stable
    ? a.amount.toFixed(STABLE_DIGITS)
    : a.amount.toLocaleString("en-US", { maximumSignificantDigits: AMOUNT_SIG });
  return `${n} ${a.unit}`;
}

/** Under the ZEC line: how much of it can move now, and what is still resting or confirming. */
function zecLine(p: PortfolioView, state: WalletState): string {
  const z = p.zec;
  const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: ZEC_DIGITS });
  const parts = [
    z.resting > 0
      ? `${fmt(z.resting)} resting${state.restingUntil ? ` · ${short(state.restingUntil - Date.now())}` : ""}`
      : null,
    z.confirming > 0 ? `${fmt(z.confirming)} confirming` : null,
    z.orchard > 0 ? `${fmt(z.orchard)} to move` : null,
  ].filter(Boolean);
  if (parts.length === 0) return z.total > 0 ? "Shielded · spendable" : "Shielded";
  return `${fmt(z.spendable)} spendable · ${parts.join(" · ")}`;
}

function Row({ a, line, hidden, onOpen }: { a: Asset; line: string; hidden: boolean; onOpen?: () => void }) {
  const body = (
    <>
      <span className="relative shrink-0">
        <Mark symbol={a.symbol} src={a.src ?? null} size={36} held={a.src !== undefined && a.src !== null} />
        {a.venue ? (
          <VenueMark venue={a.venue} size={16} className="absolute -right-1 -bottom-1 ring-2 ring-[var(--stage)]" />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <span className="truncate font-medium text-[15px]">{a.symbol}</span>
        <span className="num truncate text-[12px] text-muted">
          {line}
          {a.pnlUsd !== undefined && a.pnlUsd !== null ? (
            <>
              {" · "}
              <Signed v={a.pnlUsd} hidden={hidden} />
            </>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 leading-tight">
        <span className="num font-semibold text-[15px]">
          {hidden ? MASK : a.valueUsd === null ? amountText(a) : usd(a.valueUsd)}
        </span>
        {a.valueUsd === null ? null : (
          <span className="num text-[12px] text-muted">{hidden ? MASK : amountText(a)}</span>
        )}
      </span>
      {a.href || onOpen ? <ChevronRight size={16} className="shrink-0 text-muted" /> : null}
    </>
  );
  const row = "flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left";
  if (a.href) {
    return (
      <Link href={a.href} className={cx(row, "hover:bg-surface-1")}>
        {body}
      </Link>
    );
  }
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={cx(row, "hover:bg-surface-1")}>
        {body}
      </button>
    );
  }
  return <div className={row}>{body}</div>;
}

/**
 * Your assets, token by token and largest first: the shielded ZEC, each venue's cash (however many wallets hold it)
 * and each Solana token, with its mark, where it is, how much of it and what it is worth now. Positions have their
 * own section; all of it counts in the total above.
 */
export function YourAssets({ p, state }: { p: PortfolioView; state: WalletState }) {
  const [hidden] = useHideAmounts();
  const reading = p.loading && p.assets.length === 1;
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-2 font-semibold text-[15px]">Your assets</h2>
      <ul className="flex flex-col">
        {p.assets.map((a) => (
          <li key={a.key}>
            <Row
              a={a}
              hidden={hidden}
              line={a.key === "zec" ? zecLine(p, state) : `${a.where}${a.wallets > 1 ? ` · ${a.wallets} wallets` : ""}`}
            />
          </li>
        ))}
        {reading ? (
          <li className="px-2 py-3">
            <Skeleton className="h-9 rounded-lg" label="Reading your wallets, privately" />
          </li>
        ) : null}
      </ul>
    </section>
  );
}
