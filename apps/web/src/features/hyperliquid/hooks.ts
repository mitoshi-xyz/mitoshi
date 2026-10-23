"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { hlLive, hlMarket } from "./hl";

const PERPS_STALE_MS = 30_000;
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
