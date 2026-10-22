"use client";

import { type Levels, MarketChart } from "@mitoshi/chart";
import { INTERVALS, type Interval, type LiveStatus } from "@mitoshi/venues/hyperliquid";
import { CandlestickChart, LineChart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChartLoading, cx, LiveDot } from "@/kit";
import { price } from "../format";
import { hlLive, hlMarket } from "../hyperliquid/hl";

interface WsCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

type View = "live" | Interval;

const VIEWS: View[] = ["live", ...(Object.keys(INTERVALS) as Interval[])];
const LABEL: Record<View, string> = {
  live: "Live",
  ...Object.fromEntries(Object.keys(INTERVALS).map((k) => [k, k])),
} as Record<View, string>;
const STATUS_WORDS: Record<LiveStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  reconnecting: "Reconnecting",
};

/**
 * The terminal's chart: "Live" is the price itself at 60 Hz (fed by every trade and top-of-book change on the relay's
 * feed); the intervals are candles (history over OHTTP, then live candle updates), as a line or as bars.
 */
export function ChartPanel({ coin, levels }: { coin: string; levels: Levels }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const [view, setView] = useState<View>("live");
  const [bars, setBarsStyle] = useState<"candles" | "line">("candles");
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState<LiveStatus>("connecting");

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
  useEffect(() => hlLive().onStatus(setStatus), []);
  useEffect(() => chart.current?.setMode(view === "live" ? "live" : bars), [view, bars]);

  // The live price: trades and top-of-book mid, whatever the view (it also moves the open candle).
  useEffect(() => {
    const feed = hlLive();
    const stopTrades = feed.subscribe({ type: "trades", coin }, (data) => {
      const last = (data as { px: string }[]).at(-1);
      if (last) chart.current?.pushPrice(Number(last.px));
    });
    const stopBbo = feed.subscribe({ type: "bbo", coin }, (data) => {
      const [bid, ask] = (data as { bbo: [{ px: string } | null, { px: string } | null] }).bbo;
      if (bid && ask) chart.current?.pushPrice((Number(bid.px) + Number(ask.px)) / 2);
    });
    return () => {
      stopTrades();
      stopBbo();
    };
  }, [coin]);

  // History and live candles for the chosen interval.
  useEffect(() => {
    if (view === "live") {
      setLoad("ready");
      return;
    }
    let current = true;
    setLoad("loading");
    hlMarket.candles(coin, view).then(
      (rows) => {
        if (!current) return;
        chart.current?.setBars(rows);
        setLoad("ready");
      },
      () => current && setLoad("error"),
    );
    const stop = hlLive().subscribe({ type: "candle", coin, interval: view }, (data) => {
      const c = data as WsCandle;
      chart.current?.pushBar({
        t: c.t,
        o: Number(c.o),
        h: Number(c.h),
        l: Number(c.l),
        c: Number(c.c),
        v: Number(c.v),
      });
    });
    return () => {
      current = false;
      stop();
    };
  }, [coin, view]);

  return (
    <div className="relative flex h-full min-h-[420px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div className="flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] rounded-full bg-surface-1/80 p-0.5 backdrop-blur">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cx(
                "h-7 shrink-0 rounded-full px-2.5 font-medium text-xs transition-colors",
                view === v ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
              )}
            >
              {LABEL[v]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cx("inline-flex items-center gap-1.5 text-xs", status === "live" ? "text-up" : "text-muted")}
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
            Could not load {coin} candles. Choose another interval to try again.
          </p>
        ) : null}
      </div>
    </div>
  );
}
