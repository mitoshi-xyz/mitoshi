"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { hlDriver } from "./hl-driver";
import type { PerpDriver, PerpMarket, PerpStats, PerpVenue } from "./model";
import { pmDriver } from "./pm-driver";

const MARKETS_STALE_MS = 30_000;
const ACCOUNT_REFRESH_MS = 5_000;
const MARKS_FLUSH_MS = 1_000;
const SPARK_STALE_MS = 300_000;
const SPARK_POINTS = 24;

export const DRIVERS: Record<PerpVenue, PerpDriver> = { hyperliquid: hlDriver, pmperps: pmDriver };
export const PERP_VENUES: PerpVenue[] = ["hyperliquid", "pmperps"];

/** Every market on one venue (meta and today's numbers). */
export function usePerpMarkets(venue: PerpVenue) {
  return useQuery({
    queryKey: ["perps", venue, "markets"],
    queryFn: () => DRIVERS[venue].markets(),
    staleTime: MARKETS_STALE_MS,
    refetchInterval: MARKETS_STALE_MS,
  });
}

/** Live marks for every market on a venue, flushed to React at most once a second. */
export function useLiveMarks(venue: PerpVenue): Record<string, number> {
  const [marks, setMarks] = useState<Record<string, number>>({});
  useEffect(() => {
    setMarks({});
    let pending: Record<string, number> = {};
    let dirty = false;
    const stop = DRIVERS[venue].subscribeMarks((m) => {
      pending = { ...pending, ...m };
      dirty = true;
    });
    const flush = setInterval(() => {
      if (!dirty) return;
      dirty = false;
      const next = pending;
      setMarks((prev) => ({ ...prev, ...next }));
    }, MARKS_FLUSH_MS);
    return () => {
      stop();
      clearInterval(flush);
    };
  }, [venue]);
  return marks;
}

/** One market's live numbers (mark, funding, open interest). */
export function useLiveStats(m: PerpMarket | undefined): PerpStats | null {
  const [stats, setStats] = useState<PerpStats | null>(null);
  const key = m ? `${m.venue}:${m.id}` : "";
  useEffect(() => {
    setStats(null);
    if (!m) return;
    return DRIVERS[m.venue].subscribeStats(m, setStats);
    // Keyed by venue and id: the market object itself is refreshed every 30 s.
  }, [key]);
  return stats;
}

/** A private wallet's account on a venue, refreshed every few seconds over OHTTP. */
export function usePerpAccount(venue: PerpVenue, w: PrivateWallet | undefined) {
  return useQuery({
    queryKey: ["perps", venue, "account", w?.id],
    queryFn: () => {
      if (!w) throw new Error("no wallet");
      return DRIVERS[venue].account(w);
    },
    enabled: Boolean(w),
    refetchInterval: ACCOUNT_REFRESH_MS,
  });
}

/** The last 24 hours as hourly closes, for a row's sparkline. */
export function usePerpSparkline(m: PerpMarket) {
  return useQuery({
    queryKey: ["perps", m.venue, "spark", m.id],
    queryFn: async () => (await DRIVERS[m.venue].candles(m, "1h", Date.now(), SPARK_POINTS)).map((c) => c.c),
    staleTime: SPARK_STALE_MS,
  });
}
