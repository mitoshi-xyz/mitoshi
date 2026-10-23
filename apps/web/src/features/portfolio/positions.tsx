"use client";

import type { SolToken } from "@mitoshi/venues/solana";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Eye } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cue, cx, EmptyState, Skeleton } from "@/kit";
import { price, usd } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { DRIVERS, usePerpMarkets } from "../perps/hooks";
import { terminalHref } from "../perps/model";
import { openPublicView } from "../private-wallets/drawers";
import { shortAddress } from "../private-wallets/venues";
import { MASK, useHideAmounts } from "../shell/prefs";
import type { PositionRow } from "./book";

const SIZE_DIGITS = 4;
const MINT_HEAD = 4;

function Pnl({ v, hidden }: { v: number | null; hidden: boolean }) {
  if (v === null) return <span className="text-muted">–</span>;
  if (hidden) return <span>{MASK}</span>;
  return <span className={v >= 0 ? "text-up" : "text-down"}>{`${v >= 0 ? "+" : "−"}${usd(Math.abs(v))}`}</span>;
}

/** Closes one perp at market from its own wallet, after a confirmation. */
function ClosePerp({ row }: { row: PositionRow }) {
  const venue = row.perpVenue ?? "hyperliquid";
  const markets = usePerpMarkets(venue);
  const queries = useQueryClient();
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const market = markets.data?.find((m) => m.id === row.asset);
  if (!ask) {
    return (
      <button
        type="button"
        onClick={() => setAsk(true)}
        className="h-8 rounded-full border border-strong px-3 font-medium text-[12px] hover:bg-surface-2"
      >
        Close
      </button>
    );
  }
  return (
    <span className="flex items-center gap-2">
      {error ? <span className="text-[11px] text-down">{error}</span> : null}
      <button
        type="button"
        disabled={busy || !market || row.markPx === null}
        onClick={async () => {
          if (!market || row.markPx === null) return;
          setBusy(true);
          setError(null);
          try {
            const driver = DRIVERS[venue];
            const account = await driver.account(row.w);
            const position = account.positions.find((p) => p.marketId === row.asset);
            if (position) await driver.close(row.w, market, position, row.markPx);
            cue((row.pnlUsd ?? 0) >= 0 ? "win" : "loss");
            void queries.invalidateQueries({ queryKey: ["portfolio", row.w.id] });
            setAsk(false);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
        className="h-8 rounded-full bg-down px-3 font-medium text-[12px] text-bg disabled:opacity-50"
      >
        {busy ? "Closing…" : "Close at market"}
      </button>
      <button type="button" onClick={() => setAsk(false)} className="text-[12px] text-ink-2 hover:text-ink">
        Keep
      </button>
    </span>
  );
}

/** Every open position across every wallet: predictions, perps on both venues, Solana tokens. */
export function Positions({
  rows,
  loading,
  tokens,
}: {
  rows: PositionRow[];
  loading: boolean;
  tokens: Record<string, SolToken | null | undefined>;
}) {
  const [hidden] = useHideAmounts();
  const stocks = usePerpMarkets("pmperps");
  const logos = new Map((stocks.data ?? []).map((m) => [m.id, m.logo]));
  if (loading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 rounded-lg" label="Reading each wallet from its venue, privately" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ArrowUpRight}
        title="No open positions"
        body="Open a perp or buy a token from a private wallet and it shows up here, live."
        action={{ label: "Find a market", href: "/markets" }}
      />
    );
  }
  return (
    <div className="flex flex-col">
      <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto] gap-3 border-hairline border-b px-3 pb-2 text-[11px] text-muted uppercase tracking-[0.08em] md:grid">
        <span>Market</span>
        <span className="text-right">Size</span>
        <span className="text-right">Entry</span>
        <span className="text-right">Mark</span>
        <span className="text-right">P&L</span>
        <span className="w-[120px]" />
      </div>
      <ul className="flex flex-col">
        {rows.map((r) => {
          const t = r.kind === "token" ? tokens[r.asset] : null;
          const symbol =
            r.kind === "perp"
              ? (r.label ?? r.asset)
              : r.kind === "outcome"
                ? (r.label ?? "Outcome")
                : (t?.symbol ?? `${r.asset.slice(0, MINT_HEAD)}…`);
          const href =
            r.kind === "perp"
              ? terminalHref({ venue: r.perpVenue ?? "hyperliquid", id: r.asset })
              : r.kind === "outcome"
                ? r.eventId
                  ? `/event#${r.eventId}`
                  : "/predict"
                : `/token#${r.asset}`;
          return (
            <li
              key={r.key}
              className="grid grid-cols-[repeat(2,minmax(0,1fr))] items-center gap-x-3 gap-y-1 border-hairline border-b px-3 py-3 text-[13px] md:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto]"
            >
              <span className="col-span-2 flex items-center gap-3 md:col-span-1">
                <span className="relative">
                  {r.kind === "outcome" ? (
                    <VenueMark venue="polymarket" size={30} />
                  ) : (
                    <Mark
                      symbol={symbol}
                      src={t?.icon ?? (r.perpVenue === "pmperps" ? (logos.get(r.asset) ?? null) : null)}
                      size={30}
                    />
                  )}
                  <VenueMark
                    venue={r.w.venue}
                    size={14}
                    className="absolute -right-1 -bottom-1 ring-2 ring-[var(--stage)]"
                  />
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <Link href={href} className="flex items-center gap-1.5 font-medium hover:underline">
                    {symbol}
                    {r.side ? (
                      <span
                        className={cx(
                          "rounded px-1.5 py-0.5 text-[10px] uppercase",
                          r.side === "long" ? "bg-up-wash text-up" : "bg-down-wash text-down",
                        )}
                      >
                        {r.side} {r.leverage}×
                      </span>
                    ) : null}
                  </Link>
                  <button
                    type="button"
                    onClick={() => openPublicView(r.w.id)}
                    className="num inline-flex items-center gap-1 self-start text-[11px] text-muted hover:text-ink"
                    title="What the public sees"
                  >
                    {shortAddress(r.w.address)} <Eye size={10} />
                  </button>
                </span>
              </span>
              <span className="num text-ink-2 md:text-right">
                {hidden ? MASK : r.size.toFixed(SIZE_DIGITS).replace(/\.?0+$/, "")}
                <span className="block text-[11px] text-muted">{hidden ? "" : usd(r.valueUsd)}</span>
              </span>
              <span className="num hidden text-right md:block">{r.entryPx ? price(r.entryPx) : "–"}</span>
              <span className="num hidden text-right md:block">{r.markPx ? price(r.markPx) : "–"}</span>
              <span className="num text-right">
                <Pnl v={r.pnlUsd} hidden={hidden} />
                {r.liquidationPx ? (
                  <span className="block text-[11px] text-muted">liq {price(r.liquidationPx)}</span>
                ) : null}
              </span>
              <span className="col-span-2 flex w-full justify-end md:col-span-1 md:w-[120px]">
                {r.kind === "perp" ? (
                  <ClosePerp row={r} />
                ) : (
                  <Link
                    href={href}
                    className="inline-flex h-8 items-center rounded-full border border-strong px-3 font-medium text-[12px] hover:bg-surface-2"
                  >
                    {r.redeemable ? "Redeem" : "Sell"}
                  </Link>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
