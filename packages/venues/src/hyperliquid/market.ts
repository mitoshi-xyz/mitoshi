import type { PrivateFetch } from "@mitoshi/net";
import { InfoClient } from "@nktkas/hyperliquid";
import type { PublicFootprint } from "../footprint.ts";
import { CANDLES_PER_VIEW, INFO_PAGE, INTERVALS, type Interval } from "./constants.ts";
import { OhttpTransport } from "./transport.ts";

/** One perpetual market, with today's numbers. */
export interface Perp {
  /** Coin name, e.g. "BTC". */
  name: string;
  /** Asset index used in orders. */
  asset: number;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
  markPx: number;
  midPx: number | null;
  prevDayPx: number;
  /** Change since 24 h ago, as a fraction. */
  change24h: number;
  /** Hourly funding rate, as a fraction. */
  funding: number;
  /** Open interest in USD. */
  openInterestUsd: number;
  dayVolumeUsd: number;
}

export interface Candle {
  /** Open time, ms since the epoch. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BookLevel {
  px: number;
  sz: number;
  n: number;
}

/** Public market data. Reads go over OHTTP too, so browsing never reaches Hyperliquid directly. */
export class HyperliquidMarket {
  private readonly info: InfoClient;

  constructor(send: PrivateFetch) {
    this.info = new InfoClient({ transport: new OhttpTransport(send) });
  }

  async perps(): Promise<Perp[]> {
    const [meta, ctxs] = await this.info.metaAndAssetCtxs();
    return meta.universe
      .map((u, asset) => ({ u, asset, ctx: ctxs[asset] }))
      .filter(({ u, ctx }) => ctx !== undefined && !u.isDelisted)
      .map(({ u, asset, ctx }) => {
        const markPx = Number(ctx?.markPx);
        const prevDayPx = Number(ctx?.prevDayPx);
        return {
          name: u.name,
          asset,
          szDecimals: u.szDecimals,
          maxLeverage: u.maxLeverage,
          onlyIsolated: Boolean(u.onlyIsolated),
          markPx,
          midPx: ctx?.midPx ? Number(ctx.midPx) : null,
          prevDayPx,
          change24h: prevDayPx > 0 ? markPx / prevDayPx - 1 : 0,
          funding: Number(ctx?.funding),
          openInterestUsd: Number(ctx?.openInterest) * markPx,
          dayVolumeUsd: Number(ctx?.dayNtlVlm),
        };
      });
  }

  async candles(coin: string, interval: Interval, endTime = Date.now(), count = CANDLES_PER_VIEW): Promise<Candle[]> {
    const rows = await this.info.candleSnapshot({
      coin,
      interval,
      startTime: endTime - count * INTERVALS[interval],
      endTime,
    });
    return rows.map((r) => ({
      t: r.t,
      o: Number(r.o),
      h: Number(r.h),
      l: Number(r.l),
      c: Number(r.c),
      v: Number(r.v),
    }));
  }

  async book(coin: string): Promise<{ bids: BookLevel[]; asks: BookLevel[] }> {
    const b = await this.info.l2Book({ coin });
    const side = (levels: { px: string; sz: string; n: number }[]) =>
      levels.map((l) => ({ px: Number(l.px), sz: Number(l.sz), n: l.n }));
    return { bids: side(b?.levels[0] ?? []), asks: side(b?.levels[1] ?? []) };
  }

  async mids(): Promise<Record<string, number>> {
    const m = await this.info.allMids();
    return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Number(v)]));
  }

  /** What the public sees of one account: its filled orders, ledger moves and open positions. */
  async footprint(user: `0x${string}`): Promise<PublicFootprint> {
    const [fills, ledger, state] = await Promise.all([
      this.info.userFills({ user, aggregateByTime: true }),
      this.info.userNonFundingLedgerUpdates({ user, startTime: 0 }),
      this.info.clearinghouseState({ user }),
    ]);
    const times = [...fills.map((f) => f.time), ...ledger.map((l) => l.time)];
    return {
      activity: new Set(fills.map((f) => f.oid)).size,
      activityCapped: fills.length >= INFO_PAGE,
      transfers: ledger.length,
      transfersCapped: ledger.length >= INFO_PAGE,
      openPositions: state.assetPositions.filter((p) => Number(p.position.szi) !== 0).length,
      firstSeen: times.length ? Math.min(...times) : null,
    };
  }

  /** The transaction that filled one order (for a link to Hyperliquid's explorer), or null while it has not filled. */
  async fillHash(user: `0x${string}`, oid: number): Promise<string | null> {
    const fills = await this.info.userFills({ user });
    return fills.find((f) => f.oid === oid)?.hash ?? null;
  }

  /** An account's profit and loss over the last 24 hours, from Hyperliquid's own portfolio record. */
  async dayPnl(user: `0x${string}`): Promise<number> {
    const periods = await this.info.portfolio({ user });
    const day = periods.find(([period]) => period === "day")?.[1].pnlHistory ?? [];
    const first = day[0];
    const last = day.at(-1);
    return first && last ? Number(last[1]) - Number(first[1]) : 0;
  }
}
