"use client";

import type { PrivateWallet, SwapRecord } from "@mitoshi/engine";
import { createPrivateFetch } from "@mitoshi/net";
import { OneClick, OneClickError, type QuoteResponse, type SwapInput } from "@mitoshi/rails";
import { RELAY } from "@/constants";

const HTTP_UNAUTHORIZED = 401;

/** The 1Click client; every call goes over OHTTP. */
export const oneclick = new OneClick(createPrivateFetch(RELAY));

/** Confidential swaps need a NEAR partner key on the gateway; without one, fall back to public. */
let confidentialAvailable = true;

/** A signed quote, in NEAR's confidential mode when the gateway is allowed to use it. */
export async function quote(input: SwapInput): Promise<QuoteResponse> {
  if (confidentialAvailable && !input.flexible) {
    try {
      return await oneclick.quote({ ...input, confidentiality: "basic" });
    } catch (e) {
      if (!(e instanceof OneClickError && e.status === HTTP_UNAUTHORIZED)) throw e;
      confidentialAvailable = false;
    }
  }
  return oneclick.quote(input);
}

/** Whether the last quotes could use NEAR's confidential mode (deposit and payout unlinkable on NEAR). */
export function confidentialSwaps(): boolean {
  return confidentialAvailable;
}

/** Updates the latest swap of a kind on a wallet. */
export function withSwap(w: PrivateWallet, kind: SwapRecord["kind"], patch: Partial<SwapRecord>): PrivateWallet {
  const i = w.swaps.map((s) => s.kind).lastIndexOf(kind);
  if (i < 0) return w;
  const swaps = w.swaps.slice();
  const current = swaps[i];
  if (!current) return w;
  swaps[i] = { ...current, ...patch, updatedAt: Date.now() };
  return { ...w, swaps };
}
