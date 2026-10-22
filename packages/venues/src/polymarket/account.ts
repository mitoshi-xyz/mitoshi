import { createPublicClient, createSecureClient, OrderSide, OrderType, remoteBuilderSigning } from "@polymarket/client";
import { privateKey } from "@polymarket/client/viem";
import { PUSD } from "./constants.ts";
import type { PmPosition } from "./market.ts";

/**
 * One private wallet's Polymarket account, through the official SDK (@polymarket/client 0.12.0):
 * a Deposit Wallet for a fresh signer key, gasless through Polymarket's relayer.
 *
 * - The SDK's HTTP goes wherever `globalThis.fetch` sends it. It runs in its own worker whose
 *   fetch is the OHTTP fetch, so Polymarket only ever sees the gateway.
 * - Builder headers (needed for gasless wallet creation and batches) come from the gateway's own
 *   signer at `BUILDER_SIGN_URL`; the Builder secret never reaches the browser.
 * - Orders carry no builder code: nothing about them names Mitoshi.
 */

/** The gateway's builder signer, reached inside OHTTP like any other host (services/gateway/src/builder.ts). */
export const BUILDER_SIGN_URL = "https://builder.mitoshi.internal/sign";

type Client = Awaited<ReturnType<typeof createSecureClient>>;

export interface PmOrderResult {
  ok: boolean;
  orderId: string | null;
  message: string | null;
}

export interface PmOpenOrder {
  id: string;
  assetId: string;
  side: "buy" | "sell";
  price: number;
  size: number;
  filled: number;
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? null : String(v));

function result(r: unknown): PmOrderResult {
  const o = r as { ok?: boolean; orderId?: unknown; message?: unknown };
  return { ok: Boolean(o.ok), orderId: str(o.orderId), message: str(o.message) };
}

let publicClient: ReturnType<typeof createPublicClient> | null = null;

/**
 * The ids orders use for a market's two outcomes, from the SDK's own market model: a CTF token id,
 * or a position id on a Protocol V2 market. Read with a public client (nothing is deployed).
 */
export async function tradingAssets(marketId: string): Promise<[string, string]> {
  publicClient ??= createPublicClient();
  const m = await publicClient.fetchMarket({ id: marketId });
  const pick = (o: (typeof m.outcomes)["yes"]) => String(m.version === "v2" ? o.positionId : o.tokenId);
  return [pick(m.outcomes.yes), pick(m.outcomes.no)];
}

export class PolymarketAccount {
  private readonly client: Client;

  private constructor(client: Client) {
    this.client = client;
  }

  /** Opens (and on first use deploys, gaslessly) the Deposit Wallet of a signer key. */
  static async open(keyHex: `0x${string}`): Promise<PolymarketAccount> {
    const client = await createSecureClient({
      signer: privateKey(keyHex),
      apiKey: remoteBuilderSigning({ url: BUILDER_SIGN_URL }),
    });
    return new PolymarketAccount(client);
  }

  get signer(): string {
    return this.client.account.signer;
  }

  /** The Deposit Wallet: the address the public sees on Polymarket. */
  get wallet(): string {
    return this.client.account.wallet;
  }

  /** The one-time approvals that let the exchange move this wallet's pUSD and shares (gasless). */
  async prepare(): Promise<void> {
    await this.client.setupTradingApprovals();
  }

  /** Buys an outcome with `usd` pUSD at market (fill-and-kill: never rests on the book). */
  async buy(assetId: string, usd: string, maxPrice?: number): Promise<PmOrderResult> {
    return result(
      await this.client.placeMarketOrder({
        assetId,
        side: OrderSide.BUY,
        amount: usd,
        orderType: OrderType.FAK,
        ...(maxPrice !== undefined ? { maxPrice } : {}),
      }),
    );
  }

  /** Sells `shares` of an outcome at market. */
  async sell(assetId: string, shares: string, minPrice?: number): Promise<PmOrderResult> {
    return result(
      await this.client.placeMarketOrder({
        assetId,
        side: OrderSide.SELL,
        shares,
        orderType: OrderType.FAK,
        ...(minPrice !== undefined ? { minPrice } : {}),
      }),
    );
  }

  /** A resting limit order (good till cancelled). */
  async limit(assetId: string, side: "buy" | "sell", price: string, size: string): Promise<PmOrderResult> {
    return result(
      await this.client.placeLimitOrder({
        assetId,
        side: side === "buy" ? OrderSide.BUY : OrderSide.SELL,
        price,
        size,
      }),
    );
  }

  /** The price a market order of this size would get now, from the live book. */
  async estimate(assetId: string, side: "buy" | "sell", amount: string): Promise<number> {
    return side === "buy"
      ? this.client.estimateMarketPrice({ assetId, side: OrderSide.BUY, amount, orderType: OrderType.FAK })
      : this.client.estimateMarketPrice({ assetId, side: OrderSide.SELL, shares: amount, orderType: OrderType.FAK });
  }

  async cancel(orderId: string): Promise<void> {
    await this.client.cancelOrder({ orderId });
  }

  async openOrders(): Promise<PmOpenOrder[]> {
    const page = await this.client.listOpenOrders().firstPage();
    return page.items.map((o) => ({
      id: o.id,
      assetId: o.assetId,
      side: o.side.toUpperCase() === "BUY" ? "buy" : "sell",
      price: Number(o.price),
      size: Number(o.originalSize),
      filled: Number(o.sizeMatched),
    }));
  }

  async positions(): Promise<PmPosition[]> {
    const page = await this.client.listPositions({}).firstPage();
    return page.items.map((p) => ({
      assetId: p.assetId,
      conditionId: p.conditionId,
      size: Number(p.currentSize),
      price: Number(p.currentPrice),
      valueUsd: Number(p.currentValue),
      costUsd: Number(p.entryCostUsdc),
      redeemable: p.redeemable,
      outcome: p.outcome ?? null,
      title: p.title ?? null,
      eventId: p.eventId ?? null,
    }));
  }

  /** Turns a resolved market's winning shares back into pUSD (gasless). */
  async redeem(conditionId: string): Promise<void> {
    const tx = await this.client.redeemPositions({ conditionId });
    await tx.wait();
  }

  /**
   * Moves pUSD from the Deposit Wallet into Polymarket Perps, credited to this signer's Perps
   * account (gasless; `prepare` has approved the deposit contract). The docs' minimum is 10 pUSD.
   */
  async depositToPerps(amount: bigint): Promise<string> {
    const tx = await this.client.depositToPerps({ amount });
    return (await tx.wait()).transactionHash;
  }

  /** Sends pUSD from the wallet (gasless): the trip home, to the bridge's withdrawal address. */
  async sendPusd(to: string, amount: bigint): Promise<void> {
    const tx = await this.client.transferErc20({
      tokenAddress: PUSD,
      recipientAddress: to,
      amount,
    } as Parameters<Client["transferErc20"]>[0]);
    await tx.wait();
  }
}
