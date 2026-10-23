"use client";

import { evmKey, type PrivateWallet } from "@mitoshi/engine";
import type { PmOpenOrder, PmOrderResult, PmToken } from "@mitoshi/venues/polymarket/trading";
import { RELAY } from "@/constants";
import { deviceSeed } from "../wallet/wallet-store";
import type { PmCall, PmReply, PmResults } from "./pm-protocol";

const HEX_RADIX = 16;
const HEX_CHARS_PER_BYTE = 2;
const toHex = (b: Uint8Array) =>
  `0x${Array.from(b, (x) => x.toString(HEX_RADIX).padStart(HEX_CHARS_PER_BYTE, "0")).join("")}` as `0x${string}`;

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function start(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./pm-worker.ts", import.meta.url), { type: "module", name: "mitoshi-polymarket" });
  w.onmessage = (e: MessageEvent<PmReply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if ("error" in e.data) p.reject(new Error(e.data.error));
    else p.resolve(e.data.ok);
  };
  w.onerror = (e) => {
    e.preventDefault();
    for (const p of pending.values())
      p.reject(new Error(`the Polymarket engine stopped: ${e.message || "no details"}`));
    pending.clear();
    worker = null;
  };
  worker = w;
  void call({ kind: "init", relay: RELAY, origin: window.location.origin });
  return w;
}

function call<K extends PmCall["kind"]>(msg: Extract<PmCall, { kind: K }>): Promise<PmResults[K]> {
  const w = start();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ ...msg, id });
  });
}

/**
 * One private wallet's Polymarket account, driven in the Polymarket worker. Its signer key is
 * derived from the device seed on its own path and handed to the worker for this session only.
 * Opening it deploys the Deposit Wallet (gasless), so it is opened only to trade, never to read.
 */
export class PmAccount {
  private readonly key: `0x${string}`;
  readonly wallet: string;

  private constructor(key: `0x${string}`, wallet: string) {
    this.key = key;
    this.wallet = wallet;
  }

  static async open(w: PrivateWallet): Promise<PmAccount> {
    const key = toHex(evmKey(await deviceSeed(), "polymarket", w.index).privateKey);
    const { wallet } = await call({ kind: "open", key });
    if (wallet.toLowerCase() !== w.address.toLowerCase()) throw new Error("Polymarket wallet does not match its key");
    return new PmAccount(key, wallet);
  }

  prepare() {
    return call({ kind: "prepare", key: this.key });
  }
  buy(assetId: string, usd: string, maxPrice?: number): Promise<PmOrderResult> {
    return call({ kind: "buy", key: this.key, assetId, usd, ...(maxPrice !== undefined ? { maxPrice } : {}) });
  }
  sell(assetId: string, shares: string, minPrice?: number): Promise<PmOrderResult> {
    return call({ kind: "sell", key: this.key, assetId, shares, ...(minPrice !== undefined ? { minPrice } : {}) });
  }
  limit(assetId: string, side: "buy" | "sell", price: string, size: string): Promise<PmOrderResult> {
    return call({ kind: "limit", key: this.key, assetId, side, price, size });
  }
  estimate(assetId: string, side: "buy" | "sell", amount: string): Promise<number> {
    return call({ kind: "estimate", key: this.key, assetId, side, amount });
  }
  cancel(orderId: string) {
    return call({ kind: "cancel", key: this.key, orderId });
  }
  openOrders(): Promise<PmOpenOrder[]> {
    return call({ kind: "openOrders", key: this.key });
  }
  redeem(conditionId: string) {
    return call({ kind: "redeem", key: this.key, conditionId });
  }
  /** Sends pUSD or native USDC (base units) from the wallet, gasless. */
  transfer(token: PmToken, to: string, amount: bigint) {
    return call({ kind: "transfer", key: this.key, token, to, amount: amount.toString() });
  }
  /** Moves pUSD (base units) into this wallet's Polymarket Perps account; resolves to the tx hash. */
  depositToPerps(amount: bigint): Promise<string> {
    return call({ kind: "depositToPerps", key: this.key, amount: amount.toString() });
  }
}

const opened = new Map<string, Promise<PmAccount>>();

/** The account of a Polymarket private wallet (opened once per session). */
export function pmAccount(w: PrivateWallet): Promise<PmAccount> {
  let a = opened.get(w.id);
  if (!a) {
    a = PmAccount.open(w);
    opened.set(w.id, a);
    a.catch(() => opened.delete(w.id));
  }
  return a;
}

/** The ids orders use for a market's outcomes ([first, second]), from Polymarket's own market model. */
export function pmTradingAssets(marketId: string): Promise<[string, string]> {
  return call({ kind: "assets", marketId });
}
