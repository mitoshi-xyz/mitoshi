"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { useQuery } from "@tanstack/react-query";
import { solAccount, solMarket } from "./sol";

const LIST_STALE_MS = 30_000;
const PRICE_POLL_MS = 5_000;
const HOLDINGS_POLL_MS = 8_000;

export function useTokens(search: string) {
  return useQuery({
    queryKey: ["solana", "tokens", search],
    queryFn: () => (search ? solMarket.search(search) : solMarket.trending()),
    staleTime: LIST_STALE_MS,
  });
}

export function useToken(mint: string) {
  return useQuery({
    queryKey: ["solana", "token", mint],
    queryFn: () => solMarket.token(mint),
    enabled: mint.length > 0,
    staleTime: LIST_STALE_MS,
  });
}

/** Live USD prices for a set of mints (Jupiter has no public stream, so this polls every 5 s). */
export function usePrices(mints: string[]) {
  return useQuery({
    queryKey: ["solana", "prices", mints.join(",")],
    queryFn: () => solMarket.prices(mints),
    enabled: mints.length > 0,
    refetchInterval: PRICE_POLL_MS,
  });
}

export function useHoldings(w: PrivateWallet | undefined) {
  return useQuery({
    queryKey: ["solana", "holdings", w?.id],
    queryFn: async () => {
      if (!w) throw new Error("no wallet");
      return (await solAccount(w)).holdings();
    },
    enabled: Boolean(w),
    refetchInterval: HOLDINGS_POLL_MS,
  });
}
