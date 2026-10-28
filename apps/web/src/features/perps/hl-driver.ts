"use client";

import { INTERVALS, type Interval, type Perp } from "@mitoshi/venues/hyperliquid";
import { hlAccount, hlLive, hlMarket } from "../hyperliquid/hl";
import { sendHyperliquidHome } from "../private-wallets/home";
import type { PerpDriver, PerpMarket } from "./model";

/** Hyperliquid's base taker fee (tier 0), shown as an estimate before you confirm. */
const TAKER_FEE = 0.00045;
const MIN_NOTIONAL_USD = 10;

interface WsCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

const perps = new Map<string, Perp>();

function marketOf(p: Perp): PerpMarket {
  return {
    venue: "hyperliquid",
    id: p.name,
    name: p.name,
    category: "crypto",
    maxLeverage: p.maxLeverage,
    onlyIsolated: p.onlyIsolated,
    markPx: p.markPx,
    midPx: p.midPx,
    prevDayPx: p.prevDayPx,
    funding: p.funding,
    openInterestUsd: p.openInterestUsd,
    dayVolumeUsd: p.dayVolumeUsd,
    minNotional: MIN_NOTIONAL_USD,
    takerFee: TAKER_FEE,
    logo: null,
  };
}

/** The adapter's own perp for a market (asset index and size decimals), from the last list read. */
async function perpOf(m: PerpMarket): Promise<Perp> {
  if (!perps.has(m.id)) await hlDriver.markets();
  const p = perps.get(m.id);
  if (!p) throw new Error(`${m.name} is not listed on Hyperliquid`);
  return p;
}

/** Hyperliquid perpetuals: USDC on HyperCore, one fresh account per position. */
export const hlDriver: PerpDriver = {
  venue: "hyperliquid",
  wallet: "hyperliquid",
  label: "Hyperliquid",
  collateral: "USDC",
  intervals: Object.keys(INTERVALS),

  async markets() {
    const list = await hlMarket.perps();
    for (const p of list) perps.set(p.name, p);
    return list.map(marketOf);
  },

  onStatus: (l) => hlLive().onStatus(l),

  subscribePrice(m, cb, lean) {
    const feed = hlLive();
    const stopTrades = feed.subscribe({ type: "trades", coin: m.id }, (data) => {
      const last = (data as { px: string }[]).at(-1);
      if (last) cb(Number(last.px));
    });
    // bbo is about 4 updates a second on BTC; a price line alone does well on trades.
    const stopBbo = lean
      ? () => undefined
      : feed.subscribe({ type: "bbo", coin: m.id }, (data) => {
          const [bid, ask] = (data as { bbo: [{ px: string } | null, { px: string } | null] }).bbo;
          if (bid && ask) cb((Number(bid.px) + Number(ask.px)) / 2);
        });
    return () => {
      stopTrades();
      stopBbo();
    };
  },

  subscribeStats(m, cb) {
    return hlLive().subscribe({ type: "activeAssetCtx", coin: m.id }, (data) => {
      const c = (data as { ctx: Record<string, string> }).ctx;
      const markPx = Number(c.markPx);
      cb({
        markPx,
        prevDayPx: Number(c.prevDayPx),
        funding: Number(c.funding),
        openInterestUsd: Number(c.openInterest) * markPx,
        dayVolumeUsd: Number(c.dayNtlVlm),
      });
    });
  },

  // allMids covers every market in one stream, about one update in 5 s: `ids` needs no narrowing here.
  subscribeMarks(cb) {
    return hlLive().subscribe({ type: "allMids" }, (data) => {
      const mids = (data as { mids: Record<string, string> }).mids;
      cb(Object.fromEntries(Object.entries(mids).map(([k, v]) => [k, Number(v)])));
    });
  },

  candles: (m, interval, end, count) => hlMarket.candles(m.id, interval as Interval, end, count),

  subscribeCandle(m, interval, cb) {
    return hlLive().subscribe({ type: "candle", coin: m.id, interval }, (data) => {
      const c = data as WsCandle;
      cb({ t: c.t, o: Number(c.o), h: Number(c.h), l: Number(c.l), c: Number(c.c), v: Number(c.v) });
    });
  },

  async account(w) {
    const s = await (await hlAccount(w)).state();
    return {
      free: s.withdrawable + s.spotUsdc,
      withdrawable: s.withdrawable,
      equity: s.perpValue + s.spotUsdc,
      positions: s.positions.map((p) => ({
        marketId: p.coin,
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
        marketId: o.coin,
        oid: o.oid,
        isBuy: o.isBuy,
        px: o.px,
        size: o.size,
        reduceOnly: o.reduceOnly,
        trigger: o.trigger
          ? { px: o.trigger.px, kind: o.trigger.kind.toLowerCase().includes("take") ? "tp" : "sl" }
          : null,
      })),
    };
  },

  async place(w, args, mark, step) {
    const account = await hlAccount(w);
    const perp = await perpOf(args.market);
    step("Moving the funding into the perp account");
    await account.readyForPerps();
    step(`Setting ${args.leverage}× leverage`);
    await account.setLeverage(perp, args.leverage, args.cross);
    step("Signing with this wallet's own key");
    return account.order(
      {
        perp,
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
    const account = await hlAccount(w);
    const perp = await perpOf(m);
    return account.close(
      perp,
      {
        coin: p.marketId,
        size: p.size,
        entryPx: p.entryPx,
        valueUsd: p.valueUsd,
        unrealizedPnl: p.unrealizedPnl,
        leverage: p.leverage,
        cross: p.cross,
        liquidationPx: p.liquidationPx,
        marginUsed: p.marginUsed,
      },
      mark,
    );
  },

  async cancel(w, m, oid) {
    await (await hlAccount(w)).cancel(await perpOf(m), oid);
  },

  sendHome: (w) => sendHyperliquidHome(w.id),
};
