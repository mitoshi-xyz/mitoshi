import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58 } from "@scure/base";
import { ONECLICK_SIGNING_KEY } from "./constants.ts";
import type { QuoteResponse } from "./types.ts";

const ED25519_PREFIX = "ed25519:";

/** JSON with keys sorted at every level and undefined members dropped (json-stable-stringify). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** The request fields 1Click signs (others, like appFees, are not covered). */
function signedRequest(r: QuoteResponse["quoteRequest"]) {
  return {
    dry: r.dry,
    swapType: r.swapType,
    slippageTolerance: r.slippageTolerance,
    originAsset: r.originAsset,
    depositType: r.depositType,
    destinationAsset: r.destinationAsset,
    amount: r.amount,
    refundTo: r.refundTo,
    refundType: r.refundType,
    recipient: r.recipient,
    recipientType: r.recipientType,
    deadline: r.deadline,
    quoteWaitingTimeMs: r.quoteWaitingTimeMs || undefined,
    referral: r.referral || undefined,
    virtualChainRecipient: r.virtualChainRecipient || undefined,
    virtualChainRefundRecipient: r.virtualChainRefundRecipient || undefined,
    customRecipientMsg: r.customRecipientMsg || undefined,
  };
}

/** The quote fields 1Click signs; a live quote adds its deposit address and timing. */
function signedQuote(res: QuoteResponse) {
  const q = res.quote;
  const amounts = {
    amountIn: q.amountIn,
    amountInFormatted: q.amountInFormatted,
    amountInUsd: q.amountInUsd,
    minAmountIn: q.minAmountIn,
    amountOut: q.amountOut,
    amountOutFormatted: q.amountOutFormatted,
    amountOutUsd: q.amountOutUsd,
    minAmountOut: q.minAmountOut,
  };
  if (res.quoteRequest.dry) return amounts;
  return {
    ...amounts,
    depositAddress: q.depositAddress || undefined,
    depositMemo: q.depositMemo || undefined,
    deadline: q.deadline || undefined,
    timeWhenInactive: q.timeWhenInactive || undefined,
    timeEstimate: q.timeEstimate || undefined,
    refundFee: q.refundFee || undefined,
    withdrawFee: q.withdrawFee || undefined,
  };
}

const unprefixed = (s: string) => (s.startsWith(ED25519_PREFIX) ? s.slice(ED25519_PREFIX.length) : s);

/**
 * Checks 1Click's signature on a quote: ed25519 over base58(sha256(stable JSON of the signed
 * request and quote fields plus the timestamp)), as 1Click documents ("Verify Quote Signatures").
 */
export function verifyQuote(res: QuoteResponse, key: string = ONECLICK_SIGNING_KEY): boolean {
  try {
    const message = stableStringify({
      ...signedRequest(res.quoteRequest),
      ...signedQuote(res),
      timestamp: res.timestamp,
    });
    const digest = base58.encode(sha256(new TextEncoder().encode(message)));
    return ed25519.verify(
      base58.decode(unprefixed(res.signature)),
      new TextEncoder().encode(digest),
      base58.decode(unprefixed(key)),
    );
  } catch {
    return false;
  }
}
