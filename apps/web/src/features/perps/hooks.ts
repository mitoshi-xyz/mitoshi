"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { hlDriver } from "./hl-driver";
import type { PerpDriver, PerpMarket, PerpStats, PerpVenue } from "./model";
import { pmDriver } from "./pm-driver";

const MARKETS_STALE_MS = 30_000;
/**
 * Each wallet's account is read on its own random rhythm (4–8 s) after a random first delay, never on a shared clock:
 * a venue that saw the gateway ask about several addresses at the same instant, again and again, could tie them.
 */
const ACCOUNT_REFRESH_MIN_MS = 4_000;
const ACCOUNT_REFRESH_SPREAD_MS = 4_000;
const FIRST_READ_MAX_MS = 1_500;
const jitter = (spread: number) => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % spread;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
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
export function useLiveMarks(venue: PerpVenue, ids?: readonly string[]): Record<string, number> {
  const [marks, setMarks] = useState<Record<string, number>>({});
  const only = ids?.join(",") ?? null;
  useEffect(() => {
    setMarks({});
    let pending: Record<string, number> = {};
    let dirty = false;
    const stop = DRIVERS[venue].subscribeMarks(
      (m) => {
        pending = { ...pending, ...m };
        dirty = true;
      },
      only === null ? undefined : only.split(",").filter(Boolean),
    );
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
  }, [venue, only]);
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
    queryFn: async () => {
      if (!w) throw new Error("no wallet");
      await sleep(jitter(FIRST_READ_MAX_MS));
      return DRIVERS[venue].account(w);
    },
    enabled: Boolean(w),
    refetchInterval: () => ACCOUNT_REFRESH_MIN_MS + jitter(ACCOUNT_REFRESH_SPREAD_MS),
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
