"use client";

import type { PrivateWallet, Registry, SwapRecord } from "@mitoshi/engine";
import { createPrivateFetch } from "@mitoshi/net";
import { OneClick, OneClickError, type QuoteResponse, type SwapInput, swapTerms } from "@mitoshi/rails";
import { RELAY } from "@/constants";

const HTTP_UNAUTHORIZED = 401;

/** The 1Click client; every call goes over OHTTP. */
export const oneclick = new OneClick(createPrivateFetch(RELAY));

/** Whether NEAR grants its confidential mode: unknown until a quote answers (the app asks on every one it can). */
export type SwapMode = "confidential" | "public" | "unknown";

let sessionMode: SwapMode = "unknown";
/** Set once 1Click refuses a confidential quote (no partner key on the gateway): public for the rest of the session. */
let refused = false;

const flexible = (q: QuoteResponse) => q.quoteRequest.swapType === "FLEX_INPUT";

/** A signed quote, in NEAR's confidential mode when it grants it; the mode is read back from the answer. */
export async function quote(input: SwapInput): Promise<QuoteResponse> {
  if (!refused && !input.flexible) {
    try {
      const q = await oneclick.quote({ ...input, confidentiality: "basic" });
      sessionMode = swapTerms(q).confidential ? "confidential" : "public";
      return q;
    } catch (e) {
      if (!(e instanceof OneClickError && e.status === HTTP_UNAUTHORIZED)) throw e;
      refused = true;
    }
  }
  const q = await oneclick.quote(input);
  if (!input.flexible) sessionMode = "public";
  return q;
}

/**
 * What NEAR granted: this session's last answer, else the newest stored quote. Polymarket's trip home is a
 * flexible-input quote, which 1Click never makes confidential, so it doesn't count either way.
 */
export function swapMode(r: Registry): SwapMode {
  if (sessionMode !== "unknown") return sessionMode;
  const quotes = r.wallets
    .flatMap((w) => w.swaps)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((s) => s.signedQuote as QuoteResponse | undefined);
  const last = quotes.find((q) => q?.quoteRequest !== undefined && !flexible(q));
  return last ? (swapTerms(last).confidential ? "confidential" : "public") : "unknown";
}

/** Updates the latest swap of a kind on a wallet. */
/** Trips home being sent from this tab right now, so the poll doesn't call one stuck while it is in flight. */
export const sending = new Set<string>();

export function withSwap(w: PrivateWallet, kind: SwapRecord["kind"], patch: Partial<SwapRecord>): PrivateWallet {
  const i = w.swaps.map((s) => s.kind).lastIndexOf(kind);
  if (i < 0) return w;
  const swaps = w.swaps.slice();
  const current = swaps[i];
  if (!current) return w;
  swaps[i] = { ...current, ...patch, updatedAt: Date.now() };
  return { ...w, swaps };
}
