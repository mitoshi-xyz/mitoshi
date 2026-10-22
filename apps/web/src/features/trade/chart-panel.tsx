"use client";

import { type ChartMode, type Levels, MarketChart } from "@mitoshi/chart";
import { INTERVALS, type Interval, type LiveStatus } from "@mitoshi/venues/hyperliquid";
import { useEffect, useRef, useState } from "react";
import { hlLive, hlMarket } from "../hyperliquid/hl";

interface WsCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
}

const STATUS_WORDS: Record<LiveStatus, string> = {
  connecting: "connecting",
  live: "live",
  reconnecting: "reconnecting…",
};

/** The live chart: history from a snapshot, then every candle update from the relay's feed. */
export function ChartPanel({ coin, levels }: { coin: string; levels: Levels }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const [interval, setIntervalName] = useState<Interval>("5m");
  const [mode, setMode] = useState<ChartMode>("candles");
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  const [status, setStatus] = useState<LiveStatus>("connecting");

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
  useEffect(() => chart.current?.setLevels(levels), [levels]);
  useEffect(() => hlLive().onStatus(setStatus), []);

  useEffect(() => {
    let current = true;
    setLoad("loading");
    hlMarket.candles(coin, interval).then(
      (bars) => {
        if (!current) return;
        chart.current?.setBars(bars);
        setLoad("ready");
      },
      () => current && setLoad("error"),
    );
    const stop = hlLive().subscribe({ type: "candle", coin, interval }, (data) => {
      const c = data as WsCandle;
      chart.current?.push({ t: c.t, o: Number(c.o), h: Number(c.h), l: Number(c.l), c: Number(c.c) });
    });
    return () => {
      current = false;
      stop();
    };
  }, [coin, interval]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex gap-1">
          {(Object.keys(INTERVALS) as Interval[]).map((i) => (
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
        <div className="flex items-center gap-3">
          <span className={`text-xs ${status === "live" ? "text-emerald-400" : "opacity-60"}`}>
            ● {STATUS_WORDS[status]}
          </span>
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
      </div>
      <div className="relative h-[420px]">
        <div ref={box} className="absolute inset-0" />
        {load === "loading" ? (
          <div
            role="status"
            className="absolute inset-0 animate-pulse rounded bg-white/5"
            aria-label="Loading the chart"
          />
        ) : null}
        {load === "error" ? (
          <p className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
            Could not load {coin} candles. Pick another interval to retry.
          </p>
        ) : null}
      </div>
    </div>
  );
}
