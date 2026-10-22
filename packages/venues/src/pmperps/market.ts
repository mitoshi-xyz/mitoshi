import type { PrivateFetch } from "@mitoshi/net";
import type { PublicFootprint } from "../footprint.ts";
import { PERPS_API, PERPS_CANDLES_PER_VIEW, PERPS_INTERVALS, type PerpsInterval, SYMBOL_SUFFIX } from "./constants.ts";

/** One Polymarket Perps instrument with today's numbers, in the shape the terminal lists markets. */
export interface PerpsMarket {
  /** Instrument id used in every order. */
  id: number;
  /** API symbol, e.g. "NVDA-USD". */
  symbol: string;
  /** What the app shows: the base, e.g. "NVDA" (or the display symbol's base, "USA500"). */
  name: string;
  category: "crypto" | "equity" | "index" | "commodity" | string;
  maxLeverage: number;
  isolatedOnly: boolean;
  closeOnly: boolean;
  quantityDecimals: number;
  priceDecimals: number;
  /** How far an order price may sit from the mark, as a fraction. */
  priceBounds: number;
  minNotional: number;
  /** Base taker fee (tier 0) for the instrument's category, as a fraction of notional. */
  takerFee: number;
  logo: string | null;
  markPx: number;
  indexPx: number;
  midPx: number | null;
  /** The price 24 h ago (the statistics window's open). */
  prevDayPx: number;
  change24h: number;
  /** Funding per interval (hourly), as a fraction. */
  funding: number;
  openInterestUsd: number;
  dayVolumeUsd: number;
}

export interface PerpsCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface RawInstrument {
  instrument_id: number;
  symbol: string;
  display_symbol?: string;
  category: string;
  isolated_only: boolean;
  close_only: boolean;
  quantity_decimals: number;
  price_decimals: number;
  price_bounds: string;
  min_notional: string;
  max_leverage: number;
  logo?: { light?: string; dark?: string };
}

interface RawTicker {
  instrument_id: number;
  index_price: string;
  mark_price: string;
  mid_price?: string;
  open_interest: string;
  funding_rate: string;
}

interface RawFees {
  fee_schedule: { category: string; taker_fee_rate: string }[];
}

interface RawStats {
  instrument_id: number;
  volume: string;
  open_price: string;
}

/** A kline row: [open time ms, open, high, low, close, volume, trades]. */
export type RawKline = [number, string, string, string, string, string, number];

export function candleOf(k: RawKline): PerpsCandle {
  return { t: k[0], o: Number(k[1]), h: Number(k[2]), l: Number(k[3]), c: Number(k[4]), v: Number(k[5]) };
}

const baseOf = (symbol: string) => (symbol.endsWith(SYMBOL_SUFFIX) ? symbol.slice(0, -SYMBOL_SUFFIX.length) : symbol);

/** Public Polymarket Perps data. Reads go over OHTTP too, so browsing never reaches Polymarket directly. */
export class PolymarketPerpsMarket {
  private readonly send: PrivateFetch;

  constructor(send: PrivateFetch) {
    this.send = send;
  }

  private async get<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(path, PERPS_API);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
    const res = await this.send(url, { headers: { accept: "application/json" } });
    const body = (await res.json()) as T | { status: "err"; error: string };
    if (!res.ok || (body && typeof body === "object" && "status" in body && body.status === "err")) {
      throw new Error(`Polymarket Perps: ${(body as { error?: string }).error ?? res.status}`);
    }
    return body as T;
  }

  /** Every live instrument, with its ticker and 24 h statistics. */
  async markets(): Promise<PerpsMarket[]> {
    const [instruments, tickers, stats, fees] = await Promise.all([
      this.get<RawInstrument[]>("/v1/info/instruments"),
      this.get<RawTicker[]>("/v1/info/tickers"),
      this.get<RawStats[]>("/v1/info/statistics"),
      this.get<RawFees>("/v1/info/fees"),
    ]);
    // Docs (fee_tier): one perpetual schedule applies to every category; a per-category entry wins if listed.
    const taker = new Map(fees.fee_schedule.map((f) => [f.category, Number(f.taker_fee_rate)]));
    const baseFee = Math.max(0, ...taker.values());
    const tick = new Map(tickers.map((t) => [t.instrument_id, t]));
    const stat = new Map(stats.map((s) => [s.instrument_id, s]));
    return instruments.flatMap((i) => {
      const t = tick.get(i.instrument_id);
      if (!t) return [];
      const s = stat.get(i.instrument_id);
      const markPx = Number(t.mark_price);
      const prevDayPx = s ? Number(s.open_price) : markPx;
      return [
        {
          id: i.instrument_id,
          symbol: i.symbol,
          name: baseOf(i.display_symbol ?? i.symbol),
          category: i.category,
          maxLeverage: i.max_leverage,
          isolatedOnly: i.isolated_only,
          closeOnly: i.close_only,
          quantityDecimals: i.quantity_decimals,
          priceDecimals: i.price_decimals,
          priceBounds: Number(i.price_bounds),
          minNotional: Number(i.min_notional),
          takerFee: taker.get(i.category) ?? baseFee,
          logo: i.logo?.dark ?? i.logo?.light ?? null,
          markPx,
          indexPx: Number(t.index_price),
          midPx: t.mid_price ? Number(t.mid_price) : null,
          prevDayPx,
          change24h: prevDayPx > 0 ? markPx / prevDayPx - 1 : 0,
          funding: Number(t.funding_rate),
          openInterestUsd: Number(t.open_interest) * markPx,
          dayVolumeUsd: s ? Number(s.volume) : 0,
        },
      ];
    });
  }

  /** The last `count` candles of one interval, oldest first. */
  async candles(
    id: number,
    interval: PerpsInterval,
    endTime = Date.now(),
    count = PERPS_CANDLES_PER_VIEW,
  ): Promise<PerpsCandle[]> {
    const rows = await this.get<RawKline[] | { data: RawKline[] }>("/v1/info/klines", {
      instrument_id: id,
      interval,
      start_timestamp: endTime - PERPS_INTERVALS[interval] * count,
      end_timestamp: endTime,
    });
    const list = Array.isArray(rows) ? rows : rows.data;
    return list.map(candleOf).sort((a, b) => a.t - b.t);
  }

  /** Whether an address has ever opened a Perps account (public; registration is permanent). */
  async registered(address: string): Promise<boolean> {
    return (await this.get<{ registered: boolean }>("/v1/info/registered", { address })).registered;
  }

  /**
   * What anyone can see about one address: its open positions, and the fills of each position's
   * current cycle (the API's public history). An address that never registered shows nothing.
   */
  async footprint(address: string): Promise<PublicFootprint> {
    const empty: PublicFootprint = {
      activity: 0,
      activityCapped: false,
      transfers: null,
      transfersCapped: false,
      openPositions: 0,
      firstSeen: null,
    };
    if (!(await this.registered(address))) return empty;
    const book = await this.get<{ positions: { instrument_id: number }[] }>("/v1/info/portfolio", { address });
    const fills = await Promise.all(
      book.positions.map((p) =>
        this.get<{ data: { timestamp: number }[]; more: boolean }>("/v1/info/position-fills", {
          address,
          instrument_id: p.instrument_id,
          sort: "asc",
        }),
      ),
    );
    const times = fills.flatMap((f) => f.data.map((d) => d.timestamp));
    return {
      activity: times.length,
      activityCapped: fills.some((f) => f.more),
      transfers: null,
      transfersCapped: false,
      openPositions: book.positions.length,
      firstSeen: times.length ? Math.min(...times) : null,
    };
  }
}
