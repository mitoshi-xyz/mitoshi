import type { PmOpenOrder, PmOrderResult } from "@mitoshi/venues/polymarket/trading";

/** Messages to the Polymarket worker. `key` is one private wallet's signer key (hex). */
type Key = { key: `0x${string}` };

export type PmCall =
  | { kind: "init"; relay: string; origin: string }
  | { kind: "assets"; marketId: string }
  | ({ kind: "open" } & Key)
  | ({ kind: "prepare" } & Key)
  | ({ kind: "buy"; assetId: string; usd: string; maxPrice?: number } & Key)
  | ({ kind: "sell"; assetId: string; shares: string; minPrice?: number } & Key)
  | ({ kind: "limit"; assetId: string; side: "buy" | "sell"; price: string; size: string } & Key)
  | ({ kind: "estimate"; assetId: string; side: "buy" | "sell"; amount: string } & Key)
  | ({ kind: "cancel"; orderId: string } & Key)
  | ({ kind: "openOrders" } & Key)
  | ({ kind: "redeem"; conditionId: string } & Key)
  | ({ kind: "sendPusd"; to: string; amount: string } & Key)
  | ({ kind: "depositToPerps"; amount: string } & Key);

export type PmReply = { id: number; ok: unknown } | { id: number; error: string };

/** What each call resolves to. */
export interface PmResults {
  init: true;
  assets: [string, string];
  open: { signer: string; wallet: string };
  prepare: undefined;
  buy: PmOrderResult;
  sell: PmOrderResult;
  limit: PmOrderResult;
  estimate: number;
  cancel: undefined;
  openOrders: PmOpenOrder[];
  redeem: undefined;
  sendPusd: undefined;
  depositToPerps: string;
}
