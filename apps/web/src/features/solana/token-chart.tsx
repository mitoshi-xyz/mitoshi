"use client";

import { type ChartMode, MarketChart } from "@mitoshi/chart";
import { CANDLE_INTERVALS, type CandleInterval } from "@mitoshi/venues/solana";
import { useEffect, useRef, useState } from "react";
import { solMarket } from "./sol";

const CANDLE_REFRESH_MS = 30_000;

/** A token's candles (GeckoTerminal, refreshed every 30 s) with the live price on the last bar. */
export function TokenChart({ mint, livePrice }: { mint: string; livePrice: number | undefined }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const last = useRef<{ t: number; o: number; h: number; l: number; c: number } | null>(null);
  const [interval, setIntervalName] = useState<CandleInterval>("15m");
  const [mode, setMode] = useState<ChartMode>("candles");
  const [load, setLoad] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    if (!box.current) return;
    const c = new MarketChart(box.current, "candles");
    chart.current = c;
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => chart.current?.setMode(mode), [mode]);

  useEffect(() => {
    let current = true;
    setLoad("loading");
    const fetchBars = () =>
      solMarket.candles(mint, interval).then(
        (bars) => {
          if (!current) return;
          chart.current?.setBars(bars);
          last.current = bars.at(-1) ?? null;
          setLoad(bars.length ? "ready" : "empty");
        },
        () => current && setLoad("error"),
      );
    void fetchBars();
    const t = setInterval(() => void fetchBars(), CANDLE_REFRESH_MS);
    return () => {
      current = false;
      clearInterval(t);
    };
  }, [mint, interval]);

  useEffect(() => {
    const bar = last.current;
    if (!bar || livePrice === undefined || !Number.isFinite(livePrice)) return;
    const next = { ...bar, c: livePrice, h: Math.max(bar.h, livePrice), l: Math.min(bar.l, livePrice) };
    last.current = next;
    chart.current?.push(next);
  }, [livePrice]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex gap-1">
          {(Object.keys(CANDLE_INTERVALS) as CandleInterval[]).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIntervalName(i)}
              className={`rounded px-2 py-0.5 ${interval === i ? "bg-white/15" : "opacity-60 hover:opacity-100"}`}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["candles", "line"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded px-2 py-0.5 capitalize ${mode === m ? "bg-white/15" : "opacity-60 hover:opacity-100"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[380px]">
        <div ref={box} className="absolute inset-0" />
        {load === "loading" ? (
          <div
            role="status"
            aria-label="Loading the chart"
            className="absolute inset-0 animate-pulse rounded bg-white/5"
          />
        ) : null}
        {load === "empty" ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm opacity-60">
            No trading history for this token yet.
          </p>
        ) : null}
        {load === "error" ? (
          <p className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
            Could not load candles. Pick another interval to retry.
          </p>
        ) : null}
      </div>
    </div>
  );
}
