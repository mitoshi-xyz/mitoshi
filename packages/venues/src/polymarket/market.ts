import type { PrivateFetch } from "@mitoshi/net";
import {
  type Category,
  CLOB_API,
  DEFAULT_MIN_SHARES,
  GAMMA_API,
  HISTORY,
  type HistoryRange,
  PAGE_SIZE,
} from "./constants.ts";

export interface Outcome {
  label: string;
  tokenId: string;
  price: number;
}

export interface PmMarket {
  id: string;
  question: string;
  /** Short label inside a multi-outcome event ("50+ bps decrease"), else the question. */
  title: string;
  conditionId: string;
  outcomes: Outcome[];
  volume24h: number;
  volume: number;
  liquidity: number;
  endDate: string | null;
  closed: boolean;
  acceptingOrders: boolean;
  tickSize: number;
  minShares: number;
  negRisk: boolean;
  image: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
  description: string;
  resolutionSource: string;
}

export interface PmEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string | null;
  endDate: string | null;
  volume24h: number;
  volume: number;
  liquidity: number;
  negRisk: boolean;
  closed: boolean;
  tags: string[];
  markets: PmMarket[];
}

export interface PricePoint {
  /** Seconds since the epoch. */
  t: number;
  p: number;
}

export interface BookSide {
  price: number;
  size: number;
}

export interface Book {
  bids: BookSide[];
  asks: BookSide[];
  tickSize: number;
  minShares: number;
}

type Json = Record<string, unknown>;

/** Tick size when a market does not report one. */
const TICK_FALLBACK = 0.01;

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? 0 : Number(v));
const maybe = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  try {
    const parsed = JSON.parse(str(v)) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

function toMarket(m: Json): PmMarket {
  const labels = list(m.outcomes);
  const prices = list(m.outcomePrices);
  const tokens = list(m.clobTokenIds);
  return {
    id: str(m.id),
    question: str(m.question),
    title: str(m.groupItemTitle) || str(m.question),
    conditionId: str(m.conditionId),
    outcomes: labels.map((label, i) => ({ label, tokenId: tokens[i] ?? "", price: num(prices[i]) })),
    volume24h: num(m.volume24hr),
    volume: num(m.volumeNum ?? m.volume),
    liquidity: num(m.liquidityNum ?? m.liquidity),
    endDate: str(m.endDate) || null,
    closed: Boolean(m.closed),
    acceptingOrders: Boolean(m.acceptingOrders),
    tickSize: num(m.orderPriceMinTickSize) || TICK_FALLBACK,
    minShares: num(m.orderMinSize) || DEFAULT_MIN_SHARES,
    negRisk: Boolean(m.negRisk),
    image: str(m.image) || null,
    bestBid: maybe(m.bestBid),
    bestAsk: maybe(m.bestAsk),
    lastTradePrice: maybe(m.lastTradePrice),
    description: str(m.description),
    resolutionSource: str(m.resolutionSource),
  };
}

function toEvent(e: Json): PmEvent {
  const markets = (Array.isArray(e.markets) ? (e.markets as Json[]) : []).map(toMarket);
  return {
    id: str(e.id),
    slug: str(e.slug),
    title: str(e.title),
    description: str(e.description),
    image: str(e.image) || str(e.icon) || null,
    endDate: str(e.endDate) || null,
    volume24h: num(e.volume24hr),
    volume: num(e.volume),
    liquidity: num(e.liquidity),
    negRisk: Boolean(e.negRisk),
    closed: Boolean(e.closed),
    tags: (Array.isArray(e.tags) ? (e.tags as Json[]) : []).map((t) => str(t.label)).filter(Boolean),
    // Open markets first, most likely first, so a card shows the outcomes that matter.
    markets: markets
      .filter((m) => !m.closed || markets.every((x) => x.closed))
      .sort((a, b) => (b.outcomes[0]?.price ?? 0) - (a.outcomes[0]?.price ?? 0)),
  };
}

/** Public Polymarket data, every request over OHTTP. */
export class PolymarketMarket {
  private readonly send: PrivateFetch;

  constructor(send: PrivateFetch) {
    this.send = send;
  }

  private async get<T>(url: string): Promise<T> {
    const res = await this.send(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Polymarket: HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  /** Open events in a category, most traded in the last 24 h first. */
  async events(category: Category, page = 0): Promise<PmEvent[]> {
    const q = new URLSearchParams({
      active: "true",
      closed: "false",
      archived: "false",
      order: "volume24hr",
      ascending: "false",
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (category !== "trending") q.set("tag_slug", category);
    return (await this.get<Json[]>(`${GAMMA_API}/events?${q}`)).map(toEvent);
  }

  /** One event by its numeric id. */
  async event(id: string): Promise<PmEvent> {
    return toEvent(await this.get<Json>(`${GAMMA_API}/events/${encodeURIComponent(id)}`));
  }

  async search(query: string): Promise<PmEvent[]> {
    const q = new URLSearchParams({ q: query, events_status: "active", limit_per_type: String(PAGE_SIZE) });
    const res = await this.get<{ events?: Json[] }>(`${GAMMA_API}/public-search?${q}`);
    return (res.events ?? []).map(toEvent);
  }

  /** An outcome's price over a range (its probability, 0 to 1). */
  async history(tokenId: string, range: HistoryRange): Promise<PricePoint[]> {
    const { interval, fidelity } = HISTORY[range];
    const q = new URLSearchParams({ market: tokenId, interval, fidelity: String(fidelity) });
    const res = await this.get<{ history?: { t: number; p: number }[] }>(`${CLOB_API}/prices-history?${q}`);
    return (res.history ?? []).map((h) => ({ t: h.t, p: Number(h.p) }));
  }

  async book(tokenId: string): Promise<Book> {
    const b = await this.get<Json>(`${CLOB_API}/book?token_id=${encodeURIComponent(tokenId)}`);
    const side = (v: unknown) =>
      (Array.isArray(v) ? (v as Json[]) : []).map((l) => ({ price: num(l.price), size: num(l.size) }));
    return {
      bids: side(b.bids).sort((x, y) => y.price - x.price),
      asks: side(b.asks).sort((x, y) => x.price - y.price),
      tickSize: num(b.tick_size) || TICK_FALLBACK,
      minShares: num(b.min_order_size) || DEFAULT_MIN_SHARES,
    };
  }
}
