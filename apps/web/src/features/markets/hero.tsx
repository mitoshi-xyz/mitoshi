"use client";

import { MarketChart } from "@mitoshi/chart";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChangeChip, cx, RollingNumber, Skeleton } from "@/kit";
import { price } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { DRIVERS, useLiveStats, usePerpMarkets } from "../perps/hooks";
import { type PerpVenue, terminalHref } from "../perps/model";

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

/** The Markets hero: one live market at 60 Hz, and the two buttons that trade it from a brand-new wallet. */
export function MarketsHero() {
  const [pick, setPick] = useState(HERO[0] ?? { venue: "hyperliquid" as const, id: "BTC" });
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const hl = usePerpMarkets("hyperliquid");
  const pm = usePerpMarkets("pmperps");
  const all = [...(hl.data ?? []), ...(pm.data ?? [])];
  const marketOf = (h: { venue: PerpVenue; id: string }) => all.find((m) => m.venue === h.venue && m.id === h.id);
  const market = marketOf(pick);
  const stats = useLiveStats(market);
  // The rolling number follows the venue's mark (about once a second); the chart takes every tick.
  const mark = stats?.markPx || market?.markPx || 0;
  const change = market && market.prevDayPx > 0 ? mark / market.prevDayPx - 1 : 0;
  const key = `${pick.venue}:${pick.id}`;

  useEffect(() => {
    if (!box.current) return;
    const c = new MarketChart(box.current, { mode: "live", format: price });
    chart.current = c;
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.reset();
    if (!market) return;
    return DRIVERS[market.venue].subscribePrice(market, (px) => chart.current?.pushPrice(px), true);
    // One subscription per market; the list refreshing does not restart it.
  }, [key, Boolean(market)]);

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
      <div className="relative h-[260px] md:h-[320px]">
        <div ref={box} className="absolute inset-0" />
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
