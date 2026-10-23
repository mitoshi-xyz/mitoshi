"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import {
  candleOf,
  PERPS_INTERVALS,
  PERPS_MIN_DEPOSIT_USD,
  type PerpsInterval,
  type PerpsMarket,
  type RawKline,
} from "@mitoshi/venues/pmperps";
import { PUSD_DECIMALS } from "@mitoshi/venues/polymarket";
import { ppAccount, ppLive, ppMarket } from "../pmperps/pp";
import { pmMarket } from "../polymarket/pm";
import { pmAccount } from "../polymarket/pm-account";
import { sendPolymarketHome } from "../private-wallets/home";
import { putWallet, walletById } from "../private-wallets/registry-store";
import type { PerpAccount, PerpDriver, PerpMarket } from "./model";

const CREDIT_POLL_MS = 3_000;
const CREDIT_TRIES = 40;
const PUSD_UNITS = 10 ** PUSD_DECIMALS;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A statistics update: 24h volume (USD), the price 24h ago, and hourly candles; the last one closes at the latest trade. */
interface StatsUpdate {
  iid: number;
  vol: string;
  open: string;
  klines?: unknown[][];
}
/** Where a raw candle keeps its close: [time, open, high, low, close, volume, trades]. */
const CLOSE = 4;
const lastPrice = (d: StatsUpdate) => Number(d.klines?.at(-1)?.[CLOSE] ?? Number.NaN);

const bySymbol = new Map<string, PerpsMarket>();
const symbolOf = new Map<number, string>();

function marketOf(m: PerpsMarket): PerpMarket {
  return {
    venue: "pmperps",
    id: m.symbol,
    name: m.name,
    category: m.category,
    maxLeverage: m.maxLeverage,
    onlyIsolated: m.isolatedOnly,
    markPx: m.markPx,
    midPx: m.midPx,
    prevDayPx: m.prevDayPx,
    funding: m.funding,
    openInterestUsd: m.openInterestUsd,
    dayVolumeUsd: m.dayVolumeUsd,
    minNotional: m.minNotional,
    takerFee: m.takerFee,
    logo: m.logo,
  };
}

async function instrumentOf(m: PerpMarket): Promise<PerpsMarket> {
  if (!bySymbol.has(m.id)) await pmDriver.markets();
  const i = bySymbol.get(m.id);
  if (!i) throw new Error(`${m.name} is not listed on Polymarket Perps`);
  return i;
}

/**
 * Subscribes once `load` settles (the feed speaks instrument ids, known after the list loads). A cleanup that comes
 * first cancels it, so a quick market change never leaves a subscription open.
 */
function once<T>(load: Promise<T>, open: (v: T) => () => void): () => void {
  let stop: (() => void) | null = null;
  let cancelled = false;
  void load.then((v) => {
    if (!cancelled) stop = open(v);
  });
  return () => {
    cancelled = true;
    stop?.();
  };
}

/** Instrument ids from the feed, as the terminal's market ids (loads the list once if needed). */
async function ready(): Promise<void> {
  if (symbolOf.size === 0) await pmDriver.markets();
}

/**
 * Moves the wallet's Deposit Wallet pUSD into its Perps account (gasless), then waits until
 * Perps has credited it. The first deposit is what opens the Perps account.
 */
async function moveIn(w: PrivateWallet, step: (s: string) => void): Promise<void> {
  const cash = await pmMarket.pusd(w.address);
  if (cash < PERPS_MIN_DEPOSIT_USD) {
    throw new Error(
      `Polymarket Perps takes at least ${PERPS_MIN_DEPOSIT_USD} pUSD; this wallet holds ${cash.toFixed(2)}`,
    );
  }
  const pm = await pmAccount(w);
  if (!walletById(w.id)?.prepared) {
    step("Setting up the wallet, gasless");
    await pm.prepare();
    const latest = walletById(w.id);
    if (latest) putWallet({ ...latest, prepared: true });
  }
  step(`Moving ${cash.toFixed(2)} pUSD into Perps`);
  await pm.depositToPerps(BigInt(Math.floor(cash * PUSD_UNITS)));
  step("Waiting for Perps to credit it");
  const perps = await ppAccount(w);
  for (let i = 0; i < CREDIT_TRIES; i++) {
    if (await ppMarket.registered(perps.address)) {
      const s = await perps.state();
      if (s.available > 0) return;
    }
    await sleep(CREDIT_POLL_MS);
  }
  throw new Error("Perps has not credited the deposit yet; your pUSD is on its way, try again in a minute");
}

/** Polymarket Perps: stocks, indices, commodities and crypto, margined in pUSD from a Polymarket wallet. */
export const pmDriver: PerpDriver = {
  venue: "pmperps",
  wallet: "polymarket",
  label: "Polymarket",
  collateral: "pUSD",
  intervals: Object.keys(PERPS_INTERVALS),

  async markets() {
    const list = await ppMarket.markets();
    for (const m of list) {
      bySymbol.set(m.symbol, m);
      symbolOf.set(m.id, m.symbol);
    }
    return list.filter((m) => !m.closeOnly).map(marketOf);
  },

  onStatus: (l) => ppLive().onStatus(l),

  subscribePrice(m, cb, lean) {
    return once(instrumentOf(m), (i) => {
      const coin = String(i.id);
      const feed = ppLive();
      const a = lean
        ? () => undefined
        : feed.subscribe({ type: "bbo", coin }, (data) => {
            const d = data as { bp?: string; ap?: string };
            if (d.bp && d.ap) cb((Number(d.bp) + Number(d.ap)) / 2);
          });
      const b = feed.subscribe({ type: "trades", coin }, (data) => {
        const last = (data as { p: string }[]).at(-1);
        if (last) cb(Number(last.p));
      });
      return () => {
        a();
        b();
      };
    });
  },

  subscribeStats(m, cb) {
    // The price comes from the book, the 24h open and volume from statistics. Funding and open interest are left to the
    // market list (refreshed every 30 s): only `tickers` streams them, at about 8 updates a second.
    return once(instrumentOf(m), (i) => {
      const coin = String(i.id);
      const feed = ppLive();
      let day: { prevDayPx: number; dayVolumeUsd: number } | null = null;
      let markPx = Number.NaN;
      const emit = () => {
        if (Number.isFinite(markPx)) cb({ markPx, ...(day ?? {}) });
      };
      const a = feed.subscribe({ type: "statistics", coin }, (data) => {
        const d = data as StatsUpdate;
        day = { prevDayPx: Number(d.open), dayVolumeUsd: Number(d.vol) };
        if (!Number.isFinite(markPx)) markPx = lastPrice(d);
        emit();
      });
      const b = feed.subscribe({ type: "bbo", coin }, (data) => {
        const d = data as { bp?: string; ap?: string };
        if (!d.bp || !d.ap) return;
        markPx = (Number(d.bp) + Number(d.ap)) / 2;
        emit();
      });
      return () => {
        a();
        b();
      };
    });
  },

  subscribeMarks(cb, ids) {
    // statistics is about one update in 10 s per market (statistics::all, every market, about 9 a second).
    return once(ready(), () => {
      const feed = ppLive();
      const coins = ids ? ids.flatMap((id) => (bySymbol.has(id) ? [String(bySymbol.get(id)?.id)] : [])) : ["all"];
      const stops = coins.map((coin) =>
        feed.subscribe({ type: "statistics", coin }, (data) => {
          const d = data as StatsUpdate;
          const id = symbolOf.get(d.iid);
          const px = lastPrice(d);
          if (id && Number.isFinite(px)) cb({ [id]: px });
        }),
      );
      return () => {
        for (const stop of stops) stop();
      };
    });
  },

  async candles(m, interval, end, count) {
    return ppMarket.candles((await instrumentOf(m)).id, interval as PerpsInterval, end, count);
  },

  subscribeCandle(m, interval, cb) {
    return once(instrumentOf(m), (i) =>
      ppLive().subscribe({ type: "klines", coin: String(i.id), interval }, (data) => {
        for (const k of data as RawKline[]) cb(candleOf(k));
      }),
    );
  },

  /** Reading never opens anything: before its first deposit a wallet shows only its Deposit Wallet pUSD. */
  async account(w): Promise<PerpAccount> {
    const perps = await ppAccount(w);
    const [cash, registered] = await Promise.all([pmMarket.pusd(w.address), ppMarket.registered(perps.address)]);
    if (!registered) return { free: cash, withdrawable: 0, equity: cash, positions: [], orders: [] };
    await ready();
    const s = await perps.state();
    return {
      free: s.available + cash,
      withdrawable: s.withdrawable,
      equity: s.equity + cash,
      positions: s.positions.map((p) => ({
        marketId: p.symbol,
        size: p.size,
        entryPx: p.entryPx,
        valueUsd: p.valueUsd,
        unrealizedPnl: p.unrealizedPnl,
        leverage: p.leverage,
        cross: p.cross,
        liquidationPx: p.liquidationPx,
        marginUsed: p.marginUsed,
      })),
      orders: s.orders.map((o) => ({
        marketId: symbolOf.get(o.instrumentId) ?? String(o.instrumentId),
        oid: o.oid,
        isBuy: o.isBuy,
        px: o.trigger?.px ?? o.px,
        size: o.size,
        reduceOnly: o.reduceOnly,
        trigger: o.trigger,
      })),
    };
  },

  async place(w, args, mark, step) {
    const instrument = await instrumentOf(args.market);
    const perps = await ppAccount(w);
    const margin = (args.size * (args.limitPx ?? mark)) / args.leverage;
    const registered = await ppMarket.registered(perps.address);
    const available = registered ? (await perps.state()).available : 0;
    if (available < margin) await moveIn(w, step);
    step(`Setting ${args.leverage}× leverage`);
    await perps.setLeverage(instrument, args.leverage, true);
    step("Signing with this wallet's own key");
    return perps.order(
      {
        market: instrument,
        isBuy: args.isBuy,
        size: args.size,
        ...(args.limitPx !== undefined ? { limitPx: args.limitPx } : {}),
        ...(args.takeProfitPx !== undefined ? { takeProfitPx: args.takeProfitPx } : {}),
        ...(args.stopLossPx !== undefined ? { stopLossPx: args.stopLossPx } : {}),
      },
      mark,
    );
  },

  async close(w, m, p, mark) {
    const instrument = await instrumentOf(m);
    const perps = await ppAccount(w);
    const position = (await perps.state()).positions.find((x) => x.symbol === p.marketId);
    if (!position) throw new Error("that position is already closed");
    return perps.close(instrument, position, mark);
  },

  async cancel(w, _m, oid) {
    await (await ppAccount(w)).cancel([oid]);
  },

  sendHome: (w) => sendPolymarketHome(w.id),
};
