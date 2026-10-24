"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ChangeChip, ChartLoading, cx, RollingNumber, Skeleton } from "@/kit";
import { Mark, VenueMark } from "../marks/mark";
import { useLiveStats, usePerpMarkets } from "../perps/hooks";
import { IntervalSwitch } from "../perps/interval-switch";
import { type PerpVenue, terminalHref } from "../perps/model";
import { LIVE_VIEW, useMarketChart } from "../perps/use-market-chart";

/** The hero's markets: crypto on Hyperliquid, a stock and gold on Polymarket Perps. */
const HERO: readonly { venue: PerpVenue; id: string }[] = [
  { venue: "hyperliquid", id: "BTC" },
  { venue: "hyperliquid", id: "ETH" },
  { venue: "hyperliquid", id: "SOL" },
  { venue: "pmperps", id: "NVDA-USD" },
  { venue: "pmperps", id: "GOLD-USD" },
];
const PRICE_SIG = 7;
const VENUE_MARK = { hyperliquid: "hyperliquid", pmperps: "polymarket" } as const;
/** The card's views: Live, and the intervals both venues serve. It opens on one minute. */
const HERO_VIEWS = [LIVE_VIEW, "1m", "15m", "1h", "1d"];

/** The Markets hero: one market's chart (one-minute history first, Live a tap away) and the two buttons that trade it. */
export function MarketsHero() {
  const [pick, setPick] = useState(HERO[0] ?? { venue: "hyperliquid" as const, id: "BTC" });
  const hl = usePerpMarkets("hyperliquid");
  const pm = usePerpMarkets("pmperps");
  const all = [...(hl.data ?? []), ...(pm.data ?? [])];
  const marketOf = (h: { venue: PerpVenue; id: string }) => all.find((m) => m.venue === h.venue && m.id === h.id);
  const market = marketOf(pick);
  const stats = useLiveStats(market);
  // The rolling number follows the venue's mark (about once a second); the chart takes every tick.
  const mark = stats?.markPx || market?.markPx || 0;
  const change = market && market.prevDayPx > 0 ? mark / market.prevDayPx - 1 : 0;
  const { box, view, setView, load, intervals } = useMarketChart(market, { style: "line", lean: true });
  const views = HERO_VIEWS.filter((v) => v === LIVE_VIEW || intervals.includes(v));

  const href = terminalHref(pick);
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        {market ? (
          <div className="flex items-center gap-3">
            <span className="relative">
              <Mark symbol={market.name} src={market.logo} size={40} />
              <VenueMark
                venue={VENUE_MARK[market.venue]}
                size={16}
                className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface-1"
              />
            </span>
            <span className="flex items-baseline gap-2">
              <RollingNumber
                value={mark}
                format={{ maximumSignificantDigits: PRICE_SIG }}
                className="font-semibold text-[28px]"
              />
              <ChangeChip change={change} />
            </span>
          </div>
        ) : (
          <Skeleton className="h-10 w-48 rounded-full" label="Loading the market" />
        )}
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-0.5 [scrollbar-width:none]">
          {HERO.map((h) => {
            const m = marketOf(h);
            const name = m?.name ?? h.id.replace("-USD", "");
            const on = h.venue === pick.venue && h.id === pick.id;
            return (
              <button
                key={`${h.venue}:${h.id}`}
                type="button"
                onClick={() => setPick(h)}
                className={cx(
                  "flex shrink-0 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-xs",
                  on ? "bg-ink text-bg" : "text-ink-2",
                )}
              >
                <Mark symbol={name} src={m?.logo ?? null} size={18} />
                {name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-4">
        <IntervalSwitch views={views} view={view} onChange={setView} className="w-fit" />
      </div>
      <div className="relative h-[240px] md:h-[300px]">
        <div ref={box} className="absolute inset-0" />
        {load === "loading" ? <ChartLoading verb="Loading the chart, privately" /> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 p-4">
        <Link
          href={href}
          className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-up font-bold text-bg tracking-[0.04em] hover:brightness-110"
        >
          <ArrowUpRight size={18} strokeWidth={3} /> LONG
        </Link>
        <Link
          href={href}
          className="flex h-12 items-center justify-center gap-1.5 rounded-full bg-down font-bold text-bg tracking-[0.04em] hover:brightness-110"
        >
          <ArrowDownRight size={18} strokeWidth={3} /> SHORT
        </Link>
      </div>
    </section>
  );
}
