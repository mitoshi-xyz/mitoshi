import type { PrivateFetch } from "@mitoshi/net";
import type { PublicFootprint } from "../footprint.ts";
import {
  CANDLE_INTERVALS,
  CANDLE_LIMIT,
  type CandleInterval,
  GECKO_API,
  JUP_API,
  SIGNATURES_PAGE,
  SOLANA_RPC,
  TOKEN_LIST_LIMIT,
} from "./constants.ts";

export interface SolToken {
  mint: string;
  symbol: string;
  name: string;
  icon: string | null;
  decimals: number;
  usdPrice: number;
  change24h: number;
  mcap: number;
  liquidity: number;
  volume24h: number;
  verified: boolean;
  organicScore: number;
}

export interface SolCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface SwapQuote {
  outAmount: bigint;
  /** Fraction (0.01 = 1%). */
  priceImpact: number;
  route: string[];
  /** Jupiter's own fee on this swap, in basis points. */
  feeBps: number;
}

type Json = Record<string, unknown>;
const PCT = 100;
const MS_PER_SECOND = 1000;

function toToken(t: Json): SolToken {
  const s = (t.stats24h ?? {}) as Json;
  return {
    mint: String(t.id),
    symbol: String(t.symbol ?? ""),
    name: String(t.name ?? ""),
    icon: typeof t.icon === "string" ? t.icon : null,
    decimals: Number(t.decimals ?? 0),
    usdPrice: Number(t.usdPrice ?? 0),
    change24h: Number(s.priceChange ?? 0) / PCT,
    mcap: Number(t.mcap ?? 0),
    liquidity: Number(t.liquidity ?? 0),
    volume24h: Number(s.buyVolume ?? 0) + Number(s.sellVolume ?? 0),
    verified: Boolean(t.isVerified),
    organicScore: Number(t.organicScore ?? 0),
  };
}

/** Public Solana token data (Jupiter for tokens and prices, GeckoTerminal for candles), over OHTTP. */
export class SolanaMarket {
  private readonly send: PrivateFetch;
  private readonly pools = new Map<string, string>();

  constructor(send: PrivateFetch) {
    this.send = send;
  }

  private async get<T>(url: string): Promise<T> {
    const res = await this.send(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Solana data: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  /** Tokens trending in the last hour, verified first. */
  async trending(): Promise<SolToken[]> {
    const list = await this.get<Json[]>(`${JUP_API}/tokens/v2/toptrending/1h?limit=${TOKEN_LIST_LIMIT}`);
    return list.map(toToken).sort((a, b) => Number(b.verified) - Number(a.verified));
  }

  async search(query: string): Promise<SolToken[]> {
    const list = await this.get<Json[]>(`${JUP_API}/tokens/v2/search?query=${encodeURIComponent(query)}`);
    return list.map(toToken);
  }

  async token(mint: string): Promise<SolToken | null> {
    const [t] = await this.search(mint);
    return t && t.mint === mint ? t : null;
  }

  /** A preview of a swap (no wallet, nothing signed): what comes out and the price impact. */
  async quote(inputMint: string, outputMint: string, amount: bigint): Promise<SwapQuote> {
    const q = new URLSearchParams({ inputMint, outputMint, amount: amount.toString() });
    const o = await this.get<Json>(`${JUP_API}/ultra/v1/order?${q}`);
    const plan = Array.isArray(o.routePlan) ? (o.routePlan as Json[]) : [];
    return {
      outAmount: BigInt(String(o.outAmount ?? "0")),
      priceImpact: Math.abs(Number(o.priceImpactPct ?? 0)),
      route: plan.map((r) => String((r.swapInfo as Json | undefined)?.label ?? "")).filter(Boolean),
      feeBps: Number(o.feeBps ?? 0),
    };
  }

  /** USD prices by mint. */
  async prices(mints: string[]): Promise<Record<string, number>> {
    if (mints.length === 0) return {};
    const res = await this.get<Record<string, { usdPrice?: number }>>(`${JUP_API}/price/v3?ids=${mints.join(",")}`);
    return Object.fromEntries(Object.entries(res).map(([m, v]) => [m, Number(v.usdPrice ?? 0)]));
  }

  /** Candles from the token's deepest pool (GeckoTerminal), oldest first, in USD. */
  async candles(mint: string, interval: CandleInterval): Promise<SolCandle[]> {
    let pool = this.pools.get(mint);
    if (!pool) {
      const res = await this.get<{ data?: { attributes?: { address?: string } }[] }>(
        `${GECKO_API}/tokens/${mint}/pools?page=1`,
      );
      pool = res.data?.[0]?.attributes?.address;
      if (!pool) return [];
      this.pools.set(mint, pool);
    }
    const [timeframe, aggregate] = CANDLE_INTERVALS[interval];
    const q = new URLSearchParams({
      aggregate: String(aggregate),
      limit: String(CANDLE_LIMIT),
      currency: "usd",
      token: mint,
    });
    const res = await this.get<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(
      `${GECKO_API}/pools/${pool}/ohlcv/${timeframe}?${q}`,
    );
    return (res.data?.attributes?.ohlcv_list ?? [])
      .map(([t = 0, o = 0, h = 0, l = 0, c = 0, v = 0]) => ({ t: t * MS_PER_SECOND, o, h, l, c, v }))
      .sort((a, b) => a.t - b.t);
  }

  /** What the public sees of one address: its transactions, newest first, and when it first appeared. */
  async footprint(address: string): Promise<PublicFootprint> {
    const res = await this.send(SOLANA_RPC, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [address, { limit: SIGNATURES_PAGE, commitment: "confirmed" }],
      }),
    });
    const body = (await res.json()) as { result?: { blockTime: number | null }[]; error?: { message?: string } };
    if (!res.ok || body.error || !body.result) throw new Error(`Solana RPC: ${body.error?.message ?? res.status}`);
    const times = body.result.map((s) => s.blockTime).filter((t): t is number => t !== null);
    return {
      activity: body.result.length,
      activityCapped: body.result.length >= SIGNATURES_PAGE,
      transfers: null,
      transfersCapped: false,
      openPositions: null,
      firstSeen: times.length ? Math.min(...times) * MS_PER_SECOND : null,
    };
  }
}
