"use client";

import { type Levels, MarketChart } from "@mitoshi/chart";
import type { LiveStatus } from "@mitoshi/venues/hyperliquid";
import { useEffect, useRef, useState } from "react";
import { price } from "../format";
import { DRIVERS } from "./hooks";
import type { PerpMarket } from "./model";

/** "Live" is the price itself at 60 Hz; anything else is a candle interval the venue serves. */
export const LIVE_VIEW = "live";
/** Charts open on one-minute candles: a record of the last hours at once, with Live one tap away. */
export const DEFAULT_VIEW = "1m";

export type BarStyle = "candles" | "line";
export type ChartLoad = "loading" | "ready" | "error";

/**
 * One market's chart, shared by the terminal and the Markets card. An interval loads its candles over OHTTP, then
 * follows live candle updates; Live eases every tick from the relay's feed, starting from the current mark so the line
 * never waits blank for the first trade.
 */
export function useMarketChart(
  market: PerpMarket | undefined,
  options: { style?: BarStyle; levels?: Levels; lean?: boolean } = {},
) {
  const { style = "candles", levels, lean = false } = options;
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const [view, setView] = useState<string>(DEFAULT_VIEW);
  const [bars, setBars] = useState<BarStyle>(style);
  const [load, setLoad] = useState<ChartLoad>("loading");
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const driver = market ? DRIVERS[market.venue] : undefined;
  const key = market ? `${market.venue}:${market.id}` : "";
  const live = view === LIVE_VIEW;

  useEffect(() => {
    if (!box.current) return;
    const c = new MarketChart(box.current, { mode: "candles", format: price });
    chart.current = c;
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (levels) chart.current?.setLevels(levels);
  }, [levels]);
  useEffect(() => (driver ? driver.onStatus(setStatus) : undefined), [driver]);
  useEffect(() => chart.current?.setMode(live ? "live" : bars), [live, bars]);
  // A venue's intervals differ: fall back to one it serves when the current one is not offered.
  useEffect(() => {
    if (driver && !live && !driver.intervals.includes(view)) setView(driver.intervals[0] ?? LIVE_VIEW);
  }, [driver, view, live]);

  // The price itself, for as long as the market is open: Live draws it, and the open candle follows it between updates.
  useEffect(() => {
    const c = chart.current;
    if (!c || !market || !driver) return;
    c.reset();
    if (market.markPx > 0) c.pushPrice(market.markPx);
    return driver.subscribePrice(market, (px) => chart.current?.pushPrice(px), lean);
    // One subscription per market; the market list refreshing does not restart it.
  }, [key]);

  useEffect(() => {
    if (!market || !driver) return;
    if (live) {
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

  return { box, view, setView, bars, setBars, load, status, intervals: driver?.intervals ?? [] };
}
