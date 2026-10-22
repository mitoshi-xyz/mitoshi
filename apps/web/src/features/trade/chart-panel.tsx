"use client";

import { type Levels, MarketChart } from "@mitoshi/chart";
import type { LiveStatus } from "@mitoshi/venues/hyperliquid";
import { CandlestickChart, LineChart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChartLoading, cx, LiveDot } from "@/kit";
import { price } from "../format";
import { DRIVERS } from "../perps/hooks";
import type { PerpMarket } from "../perps/model";

const STATUS_WORDS: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
};

/**
 * The terminal's chart: "Live" is the price itself at 60 Hz (every trade and top-of-book change on the relay's feed);
 * the intervals are candles (history over OHTTP, then live candle updates), as bars or a line.
 */
export function ChartPanel({ market, levels }: { market: PerpMarket; levels: Levels }) {
  const driver = DRIVERS[market.venue];
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const [view, setView] = useState<string>("live");
  const [bars, setBarsStyle] = useState<"candles" | "line">("candles");
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const key = `${market.venue}:${market.id}`;

  useEffect(() => {
    if (!box.current) return;
    const c = new MarketChart(box.current, { mode: "live", format: price });
    chart.current = c;
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => chart.current?.setLevels(levels), [levels]);
  useEffect(() => driver.onStatus(setStatus), [driver]);
  useEffect(() => chart.current?.setMode(view === "live" ? "live" : bars), [view, bars]);
  // A venue's intervals differ: fall back to the live view when the current one is not offered.
  useEffect(() => {
    if (view !== "live" && !driver.intervals.includes(view)) setView("live");
  }, [driver, view]);

  useEffect(() => {
    chart.current?.reset();
    return driver.subscribePrice(market, (px) => chart.current?.pushPrice(px));
  }, [key]);

  useEffect(() => {
    if (view === "live") {
      setLoad("ready");
      return;
    }
    let current = true;
    setLoad("loading");
    driver.candles(market, view).then(
      (rows) => {
        if (!current) return;
        chart.current?.setBars(rows);
        setLoad("ready");
      },
      () => current && setLoad("error"),
    );
    const stop = driver.subscribeCandle(market, view, (b) => chart.current?.pushBar(b));
    return () => {
      current = false;
      stop();
    };
  }, [key, view]);

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-surface-1/80 p-0.5 backdrop-blur [scrollbar-width:none]">
          {["live", ...driver.intervals].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cx(
                "h-7 shrink-0 rounded-full px-2.5 font-medium text-xs transition-colors",
                view === v ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
              )}
            >
              {v === "live" ? "Live" : v}
            </button>
          ))}
        </div>
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
          {view !== "live" ? (
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
