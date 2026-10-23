import type { PrivateFetch } from "@mitoshi/net";
import { ASSETS, type AssetKey, DEADLINE_MS, ONECLICK_API, SLIPPAGE_BPS } from "./constants.ts";
import { verifyQuote } from "./signature.ts";
import type { Confidentiality, QuoteRequest, QuoteResponse, StatusResponse } from "./types.ts";

export class OneClickError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function json<T>(res: Response, what: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new OneClickError(`${what}: ${body.message ?? `HTTP ${res.status}`}`, res.status);
  return body as T;
}

export interface SwapInput {
  from: AssetKey;
  to: AssetKey;
  /** Exact input, in the origin asset's base units. */
  amount: string;
  /** Where the output goes (a fresh venue wallet, or a fresh shielded address for the trip home). */
  recipient: string;
  /** Where a refund goes (a fresh shielded address for fundings, the venue wallet for returns). */
  refundTo: string;
  /** Live (with a deposit address) or a dry preview. */
  dry: boolean;
  confidentiality?: Confidentiality;
  /**
   * Accept whatever amount actually arrives (FLEX_INPUT; "the quote is not a cap"). For deposits
   * whose exact size the sender doesn't control, like Polymarket's bridge paying out after a pool
   * swap. Not available in confidential mode.
   */
  flexible?: boolean;
  now?: number;
}

/**
 * The request for a quote. It never carries appFees: Mitoshi takes no fee, so the only fee in an answer is
 * 1Click's own (and NEAR's record of a swap names no Mitoshi account).
 */
export function quoteRequest(input: SwapInput): QuoteRequest {
  const req: QuoteRequest = {
    dry: input.dry,
    swapType: input.flexible ? "FLEX_INPUT" : "EXACT_INPUT",
    slippageTolerance: SLIPPAGE_BPS,
    originAsset: ASSETS[input.from].id,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: ASSETS[input.to].id,
    amount: input.amount,
    refundTo: input.refundTo,
    refundType: "ORIGIN_CHAIN",
    recipient: input.recipient,
    recipientType: "DESTINATION_CHAIN",
    deadline: new Date((input.now ?? Date.now()) + DEADLINE_MS).toISOString(),
  };
  if (input.confidentiality && input.confidentiality !== "public" && !input.flexible) {
    req.confidentiality = input.confidentiality;
  }
  return req;
}

/** What a signed quote grants, read from 1Click's answer rather than from what was asked. */
export interface SwapTerms {
  /** NEAR's confidential mode: its public record can't pair this deposit with its payout. */
  confidential: boolean;
  /** The fees the quote lists, in basis points: 1Click's own (20 bps with a partner key, 25 without). */
  feeBps: number;
  /** What the route costs in all, in dollars: the input's value minus the output's, at 1Click's prices. */
  costUsd: number;
}

export function swapTerms(q: QuoteResponse): SwapTerms {
  const mode = q.quoteRequest.confidentiality;
  return {
    confidential: mode === "basic" || mode === "advanced",
    feeBps: (q.quoteRequest.appFees ?? []).reduce((n, f) => n + f.fee, 0),
    costUsd: Math.max(0, Number(q.quote.amountInUsd) - Number(q.quote.amountOutUsd)),
  };
}

/** The 1Click client, every call over OHTTP (`send`). */
export class OneClick {
  private readonly send: PrivateFetch;
  constructor(send: PrivateFetch) {
    this.send = send;
  }

  /**
   * A signed quote. A live quote's deposit address is used only if 1Click's signature checks out
   * and the quote answers exactly what was asked (assets, amount, recipient, refund address).
   */
  async quote(input: SwapInput): Promise<QuoteResponse> {
    const req = quoteRequest(input);
    const res = await this.send(`${ONECLICK_API}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(req),
    });
    const quote = await json<QuoteResponse>(res, "quote");
    if (!verifyQuote(quote)) throw new OneClickError("quote signature does not match 1Click's key", 0);
    const q = quote.quoteRequest;
    const asked: (keyof QuoteRequest)[] = ["originAsset", "destinationAsset", "amount", "recipient", "refundTo", "dry"];
    for (const k of asked) {
      if (q[k] !== req[k]) throw new OneClickError(`quote answers a different ${k}`, 0);
    }
    if (!req.dry && !quote.quote.depositAddress) throw new OneClickError("live quote has no deposit address", 0);
    return quote;
  }

  /** Tells 1Click a deposit was sent (optional; it speeds detection up). */
  async submitDeposit(depositAddress: string, txHash: string): Promise<void> {
    const res = await this.send(`${ONECLICK_API}/deposit/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ depositAddress, txHash }),
    });
    await json(res, "deposit submit");
  }

  /** The assets 1Click can swap: also a cheap check that it answers at all. */
  async tokens(): Promise<{ assetId: string; symbol: string; blockchain: string }[]> {
    return json(await this.send(`${ONECLICK_API}/tokens`, { headers: { accept: "application/json" } }), "tokens");
  }

  async status(depositAddress: string): Promise<StatusResponse> {
    const url = `${ONECLICK_API}/status?depositAddress=${encodeURIComponent(depositAddress)}`;
    return json<StatusResponse>(await this.send(url, { headers: { accept: "application/json" } }), "status");
  }
}

/** Base units → a decimal string ("5000000" with 8 decimals → "0.05"). */
export function formatUnits(amount: string, decimals: number): string {
  const s = amount.padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
