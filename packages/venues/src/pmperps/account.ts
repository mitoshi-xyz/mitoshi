import type { PrivateFetch } from "@mitoshi/net";
import { type Hex, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { PUSD, PUSD_DECIMALS } from "../polymarket/constants.ts";
import {
  CLIENT_ORDER_ID_BYTES,
  DUST_PUSD,
  MARKET_SLIPPAGE,
  PERPS_API,
  PROXY_LIFETIME_MS,
  PROXY_RENEW_MS,
} from "./constants.ts";
import type { PerpsMarket } from "./market.ts";
import { signCreateProxy, signOp, signWithdraw } from "./signing.ts";

/** A delegated signer for trading: the owner authorises it once, and it signs every order. */
export interface PerpsCredentials {
  proxy: Hex;
  proxyKey: Hex;
  secret: string;
  /** When the proxy stops being valid (ms). */
  expiry: number;
}

export interface PerpsPosition {
  id: number;
  symbol: string;
  /** Signed size in contracts: positive long, negative short. */
  size: number;
  entryPx: number;
  leverage: number;
  cross: boolean;
  marginUsed: number;
  valueUsd: number;
  liquidationPx: number | null;
  unrealizedPnl: number;
  funding: number;
}

export interface PerpsOpenOrder {
  oid: number;
  instrumentId: number;
  isBuy: boolean;
  px: number;
  size: number;
  reduceOnly: boolean;
  trigger: { kind: "tp" | "sl"; px: number } | null;
  at: number;
}

export interface PerpsAccountState {
  /** Total account value (equity plus unrealised PnL). */
  equity: number;
  /** What new orders can use as margin. */
  available: number;
  /** What can leave the account now (after the 10% notional reserve). */
  withdrawable: number;
  inLiquidation: boolean;
  positions: PerpsPosition[];
  orders: PerpsOpenOrder[];
}

export type PerpsOrderResult =
  | { kind: "filled"; avgPx: number; size: number; oid: number }
  | { kind: "resting"; oid: number };

export interface PerpsOrderInput {
  market: PerpsMarket;
  isBuy: boolean;
  /** Size in contracts. */
  size: number;
  /** Limit price (GTC); market orders are IOC limits MARKET_SLIPPAGE through the mark. */
  limitPx?: number;
  reduceOnly?: boolean;
  takeProfitPx?: number;
  stopLossPx?: number;
}

type Signable = boolean | number | string | undefined | readonly Signable[];

const ORDER_POLL_MS = 400;
const ORDER_POLL_TRIES = 15;
const SCALE_EPSILON = 1e-9;

/** A decimal string with at most `d` places, rounded down (sizes) or to nearest (prices). */
function fixed(x: number, d: number, round: "down" | "nearest" = "nearest"): string {
  const k = 10 ** d;
  const scaled = round === "down" ? Math.floor(x * k + SCALE_EPSILON) : Math.round(x * k);
  return (scaled / k).toFixed(d);
}

function clientOrderId(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(CLIENT_ORDER_ID_BYTES))).slice(2);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RawOrder {
  order_id: number;
  instrument_id: number;
  buy: boolean;
  price: string;
  quantity: string;
  ro: boolean;
  status: string;
  filled_quantity: string;
  resting_quantity: string;
  created_timestamp: number;
  client_order_id?: string;
  tpsl?: { kind: "tp" | "sl"; trp: string };
}

/**
 * One private wallet's Polymarket Perps account. The wallet's own key owns it and authorises a
 * proxy key that signs orders; every request goes over OHTTP, so Polymarket sees a fresh address
 * and a gateway. Collateral arrives from the wallet's Deposit Wallet and leaves back to it.
 */
export class PolymarketPerpsAccount {
  readonly address: Hex;
  private readonly send: PrivateFetch;
  private readonly ownerKey: Hex;
  private readonly onCredentials: (c: PerpsCredentials) => void;
  private creds: PerpsCredentials | null;

  /** `onCredentials` receives each new proxy, so the app can keep it in its encrypted registry. */
  constructor(
    send: PrivateFetch,
    ownerKey: Uint8Array,
    creds: PerpsCredentials | null = null,
    onCredentials: (c: PerpsCredentials) => void = () => {},
  ) {
    this.send = send;
    this.ownerKey = toHex(ownerKey);
    this.onCredentials = onCredentials;
    this.address = privateKeyToAccount(this.ownerKey).address;
    this.creds = creds;
  }

  private async call<T>(
    method: "GET" | "POST" | "DELETE" | "PATCH",
    path: string,
    opts: { query?: Record<string, string | number>; body?: unknown; auth?: boolean } = {},
  ): Promise<T> {
    const url = new URL(path, PERPS_API);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { accept: "application/json" };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (opts.auth) {
      const c = await this.credentials();
      headers["polymarket-proxy"] = c.proxy;
      headers["polymarket-secret"] = c.secret;
    }
    const res = await this.send(url, {
      method,
      headers,
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    });
    const text = await res.text();
    const body = (text ? JSON.parse(text) : null) as T | { status?: string; error?: string } | null;
    const err = body && !Array.isArray(body) && typeof body === "object" && "status" in body && body.status === "err";
    if (!res.ok || err)
      throw new Error(`Polymarket Perps: ${(body as { error?: string } | null)?.error ?? res.status}`);
    return body as T;
  }

  /** The proxy credentials, authorising a new proxy when there are none or they are about to lapse. */
  async credentials(): Promise<PerpsCredentials> {
    if (this.creds && this.creds.expiry - PROXY_RENEW_MS > Date.now()) return this.creds;
    const proxyKey = generatePrivateKey();
    const proxy = privateKeyToAccount(proxyKey).address;
    const expiry = Date.now() + PROXY_LIFETIME_MS;
    const signed = await signCreateProxy(this.ownerKey, proxy, expiry);
    const { secret } = await this.call<{ secret: string }>("POST", "/v1/account/proxy", {
      body: { op: { type: "createProxy", args: { owner: this.address, proxy, expiry } }, ...signed },
    });
    this.creds = { proxy, proxyKey, secret, expiry };
    this.onCredentials(this.creds);
    return this.creds;
  }

  /** A trading command: the compact op is what gets signed, the body op is what gets sent. */
  private async command<T>(
    method: "POST" | "DELETE" | "PATCH",
    path: string,
    signable: Signable,
    op: unknown,
  ): Promise<T> {
    const c = await this.credentials();
    const signed = await signOp(c.proxyKey, signable);
    return this.call<T>(method, path, { body: { op, ...signed }, auth: true });
  }

  async state(): Promise<PerpsAccountState> {
    const [book, orders] = await Promise.all([
      this.call<{
        positions: {
          instrument_id: number;
          symbol: string;
          size: string;
          entry_price: string;
          leverage: number;
          cross: boolean;
          initial_margin: string;
          position_value: string;
          liquidation_price: string;
          unrealized_pnl: string;
          cumulative_funding: string;
        }[];
        margin: { total_account_value: string; available_order_margin: string };
        withdrawable: string;
        in_liquidation: boolean;
      }>("GET", "/v1/account/portfolio", { auth: true }),
      this.call<RawOrder[]>("GET", "/v1/account/open-orders", { auth: true }),
    ]);
    return {
      equity: Number(book.margin.total_account_value),
      available: Number(book.margin.available_order_margin),
      withdrawable: Number(book.withdrawable),
      inLiquidation: book.in_liquidation,
      positions: book.positions
        .map((p) => ({
          id: p.instrument_id,
          symbol: p.symbol,
          size: Number(p.size),
          entryPx: Number(p.entry_price),
          leverage: p.leverage,
          cross: p.cross,
          marginUsed: Number(p.initial_margin),
          valueUsd: Number(p.position_value),
          liquidationPx: Number(p.liquidation_price) > 0 ? Number(p.liquidation_price) : null,
          unrealizedPnl: Number(p.unrealized_pnl),
          funding: Number(p.cumulative_funding),
        }))
        .filter((p) => p.size !== 0),
      orders: orders.map((o) => ({
        oid: o.order_id,
        instrumentId: o.instrument_id,
        isBuy: o.buy,
        px: Number(o.price),
        size: Number(o.resting_quantity || o.quantity),
        reduceOnly: o.ro,
        trigger: o.tpsl ? { kind: o.tpsl.kind, px: Number(o.tpsl.trp) } : null,
        at: o.created_timestamp,
      })),
    };
  }

  async setLeverage(market: PerpsMarket, leverage: number, cross: boolean) {
    const isCross = cross && !market.isolatedOnly;
    await this.command("PATCH", "/v1/trade/leverage", ["updateLeverage", [market.id, leverage, isCross]], {
      type: "updateLeverage",
      args: { iid: market.id, lev: leverage, cross: isCross },
    });
  }

  /** Places an order (market if no limit price), with optional take-profit and stop-loss exits. */
  async order(input: PerpsOrderInput, mark: number): Promise<PerpsOrderResult> {
    const { market } = input;
    const slip = Math.min(MARKET_SLIPPAGE, market.priceBounds / 2);
    const limit = input.limitPx !== undefined;
    const p = fixed(input.limitPx ?? mark * (input.isBuy ? 1 + slip : 1 - slip), market.priceDecimals);
    const qty = fixed(input.size, market.quantityDecimals, "down");
    const c = clientOrderId();
    const tif = limit ? "gtc" : "ioc";
    const main = [market.id, input.isBuy, p, qty, tif, false, input.reduceOnly ? true : undefined, c, undefined];
    const body: Record<string, unknown>[] = [
      { iid: market.id, buy: input.isBuy, p, qty, tif, po: false, ...(input.reduceOnly ? { ro: true } : {}), c },
    ];
    const exits = [
      input.takeProfitPx === undefined ? null : { kind: "tp" as const, px: input.takeProfitPx },
      input.stopLossPx === undefined ? null : { kind: "sl" as const, px: input.stopLossPx },
    ].filter((x) => x !== null);
    const raw: Signable[] = [main];
    for (const x of exits) {
      const trp = fixed(x.px, market.priceDecimals);
      raw.push([market.id, !input.isBuy, undefined, qty, undefined, false, true, undefined, [true, trp, x.kind]]);
      body.push({
        iid: market.id,
        buy: !input.isBuy,
        qty,
        po: false,
        ro: true,
        tr: { tpsl: x.kind, trp, market: true },
      });
    }
    const signable: Signable = exits.length ? ["createOrders", raw, "order"] : ["createOrders", raw];
    const op = { type: "createOrders", args: body, ...(exits.length ? { grp: "order" } : {}) };
    const placedAt = Date.now();
    const acks = await this.command<{ status: string; oid?: number; error?: string }[]>(
      "POST",
      "/v1/trade/orders",
      signable,
      op,
    );
    const first = acks[0];
    if (first?.status !== "ok" || first.oid === undefined) {
      throw new Error(`order not accepted: ${first?.error ?? "no answer"}`);
    }
    return this.settle(first.oid, c, market, placedAt);
  }

  /** Follows an accepted order to its first resting or terminal state (taker orders may queue briefly). */
  private async settle(oid: number, c: string, market: PerpsMarket, since: number): Promise<PerpsOrderResult> {
    for (let i = 0; i < ORDER_POLL_TRIES; i++) {
      const [o] = await this.call<RawOrder[]>("GET", "/v1/account/orders", {
        query: { client_order_id: c },
        auth: true,
      });
      const filled = o ? Number(o.filled_quantity) : 0;
      if (o?.status === "open" && filled === 0) return { kind: "resting", oid };
      if (o && o.status !== "open" && o.status !== "pending") {
        if (filled === 0) throw new Error(`order did not fill (${o.status.replaceAll("_", " ")})`);
        return {
          kind: "filled",
          oid,
          size: filled,
          avgPx: await this.averagePrice(oid, market, since, Number(o.price)),
        };
      }
      await wait(ORDER_POLL_MS);
    }
    return { kind: "resting", oid };
  }

  private async averagePrice(oid: number, market: PerpsMarket, since: number, fallback: number): Promise<number> {
    const fills = await this.call<{ data: { order_id: number; price: string; quantity: string }[] }>(
      "GET",
      "/v1/account/fills",
      { query: { instrument_id: market.id, start_timestamp: since - ORDER_POLL_MS, sort: "asc" }, auth: true },
    );
    const mine = fills.data.filter((f) => f.order_id === oid);
    const qty = mine.reduce((s, f) => s + Number(f.quantity), 0);
    return qty > 0 ? mine.reduce((s, f) => s + Number(f.price) * Number(f.quantity), 0) / qty : fallback;
  }

  async cancel(oids: number[]) {
    if (!oids.length) return;
    await this.command("DELETE", "/v1/trade/orders", ["cancelOrders", oids], { type: "cancelOrders", args: oids });
  }

  /** Closes a position at market (reduce-only). */
  async close(market: PerpsMarket, position: PerpsPosition, mark: number): Promise<PerpsOrderResult> {
    return this.order({ market, isBuy: position.size < 0, size: Math.abs(position.size), reduceOnly: true }, mark);
  }

  /**
   * Gets the account ready to go home: cancels open orders and requires every position closed.
   * Returns the pUSD that can be withdrawn, rounded down to the cent, or 0 when only dust is left.
   */
  async consolidate(): Promise<number> {
    const s = await this.state();
    if (s.positions.length > 0) throw new Error("close every position before sending the money home");
    await this.cancel(s.orders.map((o) => o.oid));
    return s.withdrawable < DUST_PUSD ? 0 : Number(fixed(s.withdrawable, 2, "down"));
  }

  /** Withdraws pUSD (signed by the owner) to the wallet's Deposit Wallet. */
  async withdraw(amountUsd: number, to: Hex): Promise<number> {
    const amount = BigInt(fixed(amountUsd, PUSD_DECIMALS, "down").replace(".", ""));
    const args = { account: this.address, token: PUSD as Hex, amount, to };
    const signed = await signWithdraw(this.ownerKey, args);
    const res = await this.call<{ withdraw_id: number }>("POST", "/v1/account/withdraw", {
      body: { op: { type: "withdraw", args: { ...args, amount: amount.toString() } }, ...signed },
    });
    return res.withdraw_id;
  }

  /** Withdrawals still on their way to the Deposit Wallet. */
  async pendingWithdrawals(): Promise<number> {
    const res = await this.call<{ data: unknown[] }>("GET", "/v1/account/withdrawals", {
      query: { withdrawal_status: "pending" },
      auth: true,
    });
    return res.data.length;
  }
}
