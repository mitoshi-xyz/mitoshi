import type { PrivateFetch } from "@mitoshi/net";
import { ExchangeClient, InfoClient } from "@nktkas/hyperliquid";
import { formatPrice, formatSize } from "@nktkas/hyperliquid/utils";
import { type Hex, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DUST_USDC, HL_TAKER_FEE, HL_USDC_TOKEN, MARKET_SLIPPAGE } from "./constants.ts";
import type { Perp } from "./market.ts";
import { OhttpTransport } from "./transport.ts";

export interface Position {
  coin: string;
  /** Signed size: positive long, negative short. */
  size: number;
  entryPx: number;
  valueUsd: number;
  unrealizedPnl: number;
  leverage: number;
  cross: boolean;
  liquidationPx: number | null;
  marginUsed: number;
}

export interface OpenOrder {
  coin: string;
  oid: number;
  isBuy: boolean;
  px: number;
  size: number;
  reduceOnly: boolean;
  trigger: { px: number; kind: string } | null;
  at: number;
}

export interface AccountState {
  /** USDC sitting in the spot balance (where 1Click delivers it). */
  spotUsdc: number;
  /** Perp account value, and what can leave it now. */
  perpValue: number;
  withdrawable: number;
  positions: Position[];
  orders: OpenOrder[];
  /** "default"/"disabled" keep spot and perps separate; "unifiedAccount"/"portfolioMargin" share them. */
  mode: string;
}

export type OrderResult =
  | { kind: "filled"; avgPx: number; size: number; oid: number }
  | { kind: "resting"; oid: number };

export interface OrderInput {
  perp: Perp;
  isBuy: boolean;
  /** Size in coins. */
  size: number;
  /** Limit price; market orders cross the mid by MARKET_SLIPPAGE instead. */
  limitPx?: number;
  reduceOnly?: boolean;
  takeProfitPx?: number;
  stopLossPx?: number;
}

const separateBalances = (mode: string) => mode !== "unifiedAccount" && mode !== "portfolioMargin";

const CENTS = 100;
/** USDC amount for a transfer: rounded down to the cent, so it never exceeds the balance. */
const usd = (amount: number) => (Math.floor(amount * CENTS) / CENTS).toFixed(2);

/**
 * One private wallet's Hyperliquid account. It signs with that wallet's own key only, and every
 * request (reads included) goes over OHTTP, so Hyperliquid sees a fresh address and a gateway.
 */
export class HyperliquidAccount {
  readonly address: Hex;
  private readonly info: InfoClient;
  private readonly exchange: ExchangeClient;

  constructor(send: PrivateFetch, privateKey: Uint8Array) {
    const transport = new OhttpTransport(send);
    const wallet = privateKeyToAccount(toHex(privateKey));
    this.address = wallet.address;
    this.info = new InfoClient({ transport });
    this.exchange = new ExchangeClient({ transport, wallet });
  }

  async state(): Promise<AccountState> {
    const [perp, spot, orders, mode] = await Promise.all([
      this.info.clearinghouseState({ user: this.address }),
      this.info.spotClearinghouseState({ user: this.address }),
      this.info.frontendOpenOrders({ user: this.address }),
      this.info.userAbstraction({ user: this.address }),
    ]);
    const usdc = spot.balances.find((b) => b.coin === "USDC");
    return {
      spotUsdc: usdc ? Number(usdc.total) - Number(usdc.hold) : 0,
      perpValue: Number(perp.marginSummary.accountValue),
      withdrawable: Number(perp.withdrawable),
      mode,
      positions: perp.assetPositions
        .map(({ position: p }) => ({
          coin: p.coin,
          size: Number(p.szi),
          entryPx: Number(p.entryPx),
          valueUsd: Number(p.positionValue),
          unrealizedPnl: Number(p.unrealizedPnl),
          leverage: p.leverage.value,
          cross: p.leverage.type === "cross",
          liquidationPx: p.liquidationPx === null ? null : Number(p.liquidationPx),
          marginUsed: Number(p.marginUsed),
        }))
        .filter((p) => p.size !== 0),
      orders: orders.map((o) => ({
        coin: o.coin,
        oid: o.oid,
        isBuy: o.side === "B",
        px: Number(o.limitPx),
        size: Number(o.sz),
        reduceOnly: o.reduceOnly,
        trigger: o.isTrigger ? { px: Number(o.triggerPx), kind: o.orderType } : null,
        at: o.timestamp,
      })),
    };
  }

  /**
   * Makes the funding tradable: with separate spot and perp balances, the USDC 1Click delivered to
   * spot moves to perps. Unified accounts need nothing.
   */
  async readyForPerps(): Promise<{ moved: number }> {
    const s = await this.state();
    if (!separateBalances(s.mode) || s.spotUsdc <= 0) return { moved: 0 };
    const amount = usd(s.spotUsdc);
    await this.exchange.usdClassTransfer({ amount, toPerp: true });
    return { moved: Number(amount) };
  }

  async setLeverage(perp: Perp, leverage: number, cross: boolean) {
    await this.exchange.updateLeverage({ asset: perp.asset, isCross: cross && !perp.onlyIsolated, leverage });
  }

  /** Places an order (market if no limit price), with optional take-profit and stop-loss. */
  async order(input: OrderInput, mid: number): Promise<OrderResult> {
    const { perp } = input;
    const crossPx = mid * (input.isBuy ? 1 + MARKET_SLIPPAGE : 1 - MARKET_SLIPPAGE);
    const px = formatPrice(input.limitPx ?? crossPx, perp.szDecimals);
    const size = formatSize(input.size, perp.szDecimals);
    const main = {
      a: perp.asset,
      b: input.isBuy,
      p: px,
      s: size,
      r: input.reduceOnly ?? false,
      t: { limit: { tif: input.limitPx === undefined ? ("Ioc" as const) : ("Gtc" as const) } },
    };
    const exits = [
      input.takeProfitPx === undefined ? null : { px: input.takeProfitPx, kind: "tp" as const },
      input.stopLossPx === undefined ? null : { px: input.stopLossPx, kind: "sl" as const },
    ]
      .filter((x) => x !== null)
      .map((x) => ({
        a: perp.asset,
        b: !input.isBuy,
        p: formatPrice(x.px, perp.szDecimals),
        s: size,
        r: true,
        t: { trigger: { isMarket: true, triggerPx: formatPrice(x.px, perp.szDecimals), tpsl: x.kind } },
      }));
    const res = await this.exchange.order({ orders: [main, ...exits], grouping: exits.length ? "normalTpsl" : "na" });
    const first = res.response.data.statuses[0];
    if (first && typeof first === "object" && "filled" in first) {
      return {
        kind: "filled",
        avgPx: Number(first.filled.avgPx),
        size: Number(first.filled.totalSz),
        oid: first.filled.oid,
      };
    }
    if (first && typeof first === "object" && "resting" in first) return { kind: "resting", oid: first.resting.oid };
    throw new Error(`order not accepted: ${JSON.stringify(first)}`);
  }

  async cancel(perp: Perp, oid: number) {
    await this.exchange.cancel({ cancels: [{ a: perp.asset, o: oid }] });
  }

  /** Closes a position at market (reduce-only). */
  async close(perp: Perp, position: Position, mid: number): Promise<OrderResult> {
    return this.order({ perp, isBuy: position.size < 0, size: Math.abs(position.size), reduceOnly: true }, mid);
  }

  /**
   * Gets the account ready to go home: cancels open orders, requires every position closed, and
   * (with separate balances) moves perp USDC back to spot. Returns the spot USDC that can be sent,
   * rounded down to the cent, or 0 when only dust is left.
   */
  async consolidate(perps: Perp[]): Promise<number> {
    let s = await this.state();
    if (s.positions.length > 0) throw new Error("close every position before sending the money home");
    const assetOf = new Map(perps.map((p) => [p.name, p.asset]));
    const cancels = s.orders.flatMap((o) => {
      const a = assetOf.get(o.coin);
      return a === undefined ? [] : [{ a, o: o.oid }];
    });
    if (cancels.length) await this.exchange.cancel({ cancels });
    if (separateBalances(s.mode) && s.withdrawable > 0) {
      await this.exchange.usdClassTransfer({ amount: usd(s.withdrawable), toPerp: false });
      s = await this.state();
    }
    return s.spotUsdc < DUST_USDC ? 0 : Number(usd(s.spotUsdc));
  }

  /**
   * What sending home would gather now, read only: the USDC in spot and perps, with open positions counted as closed
   * at the mark less the taker fee to close them (`closeFee`).
   */
  async homeValue(): Promise<{ usdc: number; closeFee: number; open: number }> {
    const s = await this.state();
    const closeFee = s.positions.reduce((n, p) => n + Math.abs(p.valueUsd) * HL_TAKER_FEE, 0);
    const held = separateBalances(s.mode)
      ? s.spotUsdc + s.perpValue
      : s.spotUsdc + s.positions.reduce((n, p) => n + p.marginUsed + p.unrealizedPnl, 0);
    return { usdc: held - closeFee, closeFee, open: s.positions.length };
  }

  /** Sends spot USDC to an address on HyperCore (1Click's deposit address for the trip home). */
  async sendUsdc(destination: Hex, amount: number): Promise<void> {
    await this.exchange.spotSend({ destination, token: HL_USDC_TOKEN, amount: usd(amount) });
  }
}
