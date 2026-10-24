"use client";

import type { Levels } from "@mitoshi/chart";
import type { LiveStatus } from "@mitoshi/venues/hyperliquid";
import { CandlestickChart, LineChart } from "lucide-react";
import { ChartLoading, cx, LiveDot } from "@/kit";
import { IntervalSwitch } from "../perps/interval-switch";
import type { PerpMarket } from "../perps/model";
import { LIVE_VIEW, useMarketChart } from "../perps/use-market-chart";

const STATUS_WORDS: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
};

/**
 * The terminal's chart. It opens on one-minute candles (history over OHTTP, then live candle updates), as bars or a
 * line; "Live" is the price itself at 60 Hz, every trade and top-of-book change on the relay's feed.
 */
export function ChartPanel({ market, levels }: { market: PerpMarket; levels: Levels }) {
  const {
    box,
    view,
    setView,
    bars,
    setBars: setBarsStyle,
    load,
    status,
    intervals,
  } = useMarketChart(market, { levels });

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <IntervalSwitch views={[LIVE_VIEW, ...intervals]} view={view} onChange={setView} />
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cx(
              "hidden items-center gap-1.5 text-xs sm:inline-flex",
              status === "live" ? "text-up" : "text-muted",
            )}
          >
            <LiveDot tone={status === "live" ? "up" : "muted"} />
            {STATUS_WORDS[status]}
          </span>
          {view !== LIVE_VIEW ? (
            <div className="flex rounded-full bg-surface-1/80 p-0.5">
              {(
                [
                  ["candles", CandlestickChart],
                  ["line", LineChart],
                ] as const
              ).map(([m, Icon]) => (
                <button
                  key={m}
                  type="button"
                  aria-label={m === "candles" ? "Candles" : "Line"}
                  onClick={() => setBarsStyle(m)}
                  className={cx(
                    "flex size-7 items-center justify-center rounded-full",
                    bars === m ? "bg-ink text-bg" : "text-ink-2",
                  )}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={box} className="absolute inset-0" />
        {load === "loading" ? <ChartLoading verb="Loading candles, privately" /> : null}
        {load === "error" ? (
          <p className="absolute inset-0 flex items-center justify-center text-down text-sm">
            Could not load {market.name} candles. Pick another interval.
          </p>
        ) : null}
      </div>
    </div>
  );
}
