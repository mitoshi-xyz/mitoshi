"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import type { AccountState, Perp } from "@mitoshi/venues/hyperliquid";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { hlAccount, hlLive, hlMarket } from "./hl";

const PERPS_STALE_MS = 30_000;
const SPARK_STALE_MS = 300_000;
const SPARK_POINTS = 24;
const ACCOUNT_REFRESH_MS = 5_000;
const MIDS_FLUSH_MS = 1_000;

/** Every perp market (meta and today's numbers), shared by the list and the terminal. */
export function usePerps() {
  return useQuery({
    queryKey: ["hyperliquid", "perps"],
    queryFn: () => hlMarket.perps(),
    staleTime: PERPS_STALE_MS,
    refetchInterval: PERPS_STALE_MS,
  });
}

/** Live mid prices for every coin, flushed to React at most once a second. */
export function useLiveMids(): Record<string, number> {
  const [mids, setMids] = useState<Record<string, number>>({});
  useEffect(() => {
    let pending: Record<string, string> | null = null;
    const stop = hlLive().subscribe({ type: "allMids" }, (data) => {
      pending = (data as { mids: Record<string, string> }).mids;
    });
    const flush = setInterval(() => {
      if (!pending) return;
      const next = Object.fromEntries(Object.entries(pending).map(([k, v]) => [k, Number(v)]));
      pending = null;
      setMids(next);
    }, MIDS_FLUSH_MS);
    return () => {
      stop();
      clearInterval(flush);
    };
  }, []);
  return mids;
}

export interface LiveCtx {
  markPx: number;
  midPx: number | null;
  prevDayPx: number;
  funding: number;
  openInterest: number;
  dayVolumeUsd: number;
}

/** One coin's live context (mark, funding, open interest), straight from the feed. */
export function useLiveCtx(coin: string): LiveCtx | null {
  const [ctx, setCtx] = useState<LiveCtx | null>(null);
  useEffect(() => {
    setCtx(null);
    return hlLive().subscribe({ type: "activeAssetCtx", coin }, (data) => {
      const c = (data as { ctx: Record<string, string> }).ctx;
      setCtx({
        markPx: Number(c.markPx),
        midPx: c.midPx ? Number(c.midPx) : null,
        prevDayPx: Number(c.prevDayPx),
        funding: Number(c.funding),
        openInterest: Number(c.openInterest),
        dayVolumeUsd: Number(c.dayNtlVlm),
      });
    });
  }, [coin]);
  return ctx;
}

/** A private wallet's Hyperliquid account, refreshed every few seconds over OHTTP. */
export function useAccountState(w: PrivateWallet | undefined) {
  return useQuery<AccountState>({
    queryKey: ["hyperliquid", "account", w?.id],
    queryFn: async () => {
      if (!w) throw new Error("no wallet");
      return (await hlAccount(w)).state();
    },
    enabled: Boolean(w),
    refetchInterval: ACCOUNT_REFRESH_MS,
  });
}

export function perpByName(perps: Perp[] | undefined, name: string): Perp | undefined {
  return perps?.find((p) => p.name === name);
}

/** The last 24 hours as hourly closes, for a row's sparkline. */
export function useSparkline(coin: string) {
  return useQuery({
    queryKey: ["hyperliquid", "spark", coin],
    queryFn: async () => (await hlMarket.candles(coin, "1h", Date.now(), SPARK_POINTS)).map((c) => c.c),
    staleTime: SPARK_STALE_MS,
  });
}
