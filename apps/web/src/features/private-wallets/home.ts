"use client";

import { advance, type PrivateWallet, type SwapRecord, type TradeRecord } from "@mitoshi/engine";
import { ASSETS } from "@mitoshi/rails";
import { PUSD_DECIMALS } from "@mitoshi/venues/polymarket";
import { hlAccount, hlMarket } from "../hyperliquid/hl";
import { bringPerpsHome } from "../pmperps/perps-home";
import { pmBridge, pmMarket } from "../polymarket/pm";
import { type PmAccount, pmAccount } from "../polymarket/pm-account";
import { solAccount } from "../solana/sol";
import { freshAddress } from "../wallet/wallet-store";
import { putWallet, walletById } from "./registry-store";
import { oneclick, quote, withSwap } from "./swaps";

const CENTS_TO_BASE = 10 ** (ASSETS.hypercoreUsdc.decimals - 2);
const CENTS = 100;

/** Sends a wallet's money home, whichever venue it is on. */
export function sendHome(w: PrivateWallet): Promise<{ sent: number }> {
  if (w.venue === "hyperliquid") return sendHyperliquidHome(w.id);
  if (w.venue === "solana") return sendSolanaHome(w.id);
  return sendPolymarketHome(w.id);
}

const PUSD_UNITS = 10 ** PUSD_DECIMALS;
/** Under a dollar of pUSD stays: less than the trip home costs. */
const PUSD_DUST = 1;
const SETTLE_POLL_MS = 3_000;
const SETTLE_TRIES = 20;
/** Polymarket's bridge skips deposits under this (bridge.polymarket.com/supported-assets: minCheckoutUsd for Polygon USDC). */
const BRIDGE_MIN_USD = 2;
const REWRAP_POLL_MS = 5_000;
const REWRAP_TRIES = 72;
/** The re-bridged refund counts as arrived once the wallet holds this share of it (the bridge's fee). */
const REWRAP_ARRIVED_SHARE = 0.98;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A refunded trip home comes back to the Deposit Wallet as Polygon USDC, which the trip home doesn't send. It goes
 * through the wallet's own bridge address (the one its funding used) to become pUSD again, and leaves with the rest.
 * Resolves to the USDC left behind because it is under the bridge's minimum (0 when none).
 */
async function rewrapRefund(w: PrivateWallet, account: PmAccount): Promise<number> {
  const usdc = await pmMarket.usdc(w.address);
  if (usdc === 0) return 0;
  if (usdc < BRIDGE_MIN_USD) return usdc;
  const before = await pmMarket.pusd(w.address);
  await account.transfer("usdc", await pmBridge.depositAddress(w.address), BigInt(Math.floor(usdc * PUSD_UNITS)));
  for (let i = 0; i < REWRAP_TRIES; i++) {
    await sleep(REWRAP_POLL_MS);
    if ((await pmMarket.pusd(w.address)) >= before + usdc * REWRAP_ARRIVED_SHARE) return 0;
  }
  throw new Error("the refunded USDC is still turning into pUSD; send home again in a few minutes");
}

/** Waits until a wallet holds no shares (sells and redemptions have settled on chain). */
async function settled(wallet: string): Promise<void> {
  for (let i = 0; i < SETTLE_TRIES; i++) {
    const open = (await pmMarket.positions(wallet)).filter((p) => p.size > 0 && !p.redeemable);
    if (open.length === 0) return;
    await sleep(SETTLE_POLL_MS);
  }
  throw new Error("some shares did not sell; try again in a moment");
}

/**
 * Sends one Polymarket wallet's money home: cancel its orders, redeem resolved shares, sell the
 * rest at market, withdraw anything in Polymarket Perps, then a signed 1Click quote (Polygon USDC to ZEC, any amount, to a fresh shielded
 * address), a bridge withdrawal address that pays that quote's deposit address, and one gasless
 * pUSD transfer to it. Refunds go back to the Deposit Wallet.
 */
export async function sendPolymarketHome(id: string): Promise<{ sent: number }> {
  let w = walletById(id);
  if (w?.venue !== "polymarket") throw new Error("not a Polymarket wallet");
  if (w.status !== "ready" && w.status !== "trading" && w.status !== "failed") {
    throw new Error(`a ${w.status} wallet cannot be sent home`);
  }
  const account = await pmAccount(w);
  if (!w.prepared) {
    await account.prepare();
    w = { ...(walletById(id) ?? w), prepared: true };
    putWallet(w);
  }
  for (const o of await account.openOrders()) await account.cancel(o.id);
  for (const p of await pmMarket.positions(w.address)) {
    if (p.size <= 0) continue;
    if (p.redeemable && p.conditionId) await account.redeem(p.conditionId);
    else await account.sell(p.assetId, String(p.size));
  }
  await settled(w.address);
  // Perps money first comes back to the Deposit Wallet (positions must be closed).
  await bringPerpsHome(w);
  const stranded = await rewrapRefund(w, account);
  const cash = await pmMarket.pusd(w.address);
  const now = Date.now();
  if (cash < PUSD_DUST) {
    w = advance(walletById(id) ?? w, "returning", now, "Only dust is left");
    const left = stranded ? ` (and ${stranded.toFixed(2)} USDC, under the bridge's $${BRIDGE_MIN_USD} minimum)` : "";
    putWallet(advance(w, "retired", now, `Under 1 pUSD stays${left}: less than the trip home would cost`));
    return { sent: 0 };
  }
  const amount = BigInt(Math.floor(cash * PUSD_UNITS));
  const recipient = await freshAddress();
  const out = await pmBridge.quote("out", amount.toString(), w.address);
  const q = await quote({
    from: "polygonUsdc",
    to: "zec",
    amount: out.out,
    recipient,
    refundTo: w.address,
    dry: false,
    flexible: true,
  });
  const depositAddress = q.quote.depositAddress;
  if (!depositAddress) throw new Error("the quote has no deposit address");
  const withdrawal = await pmBridge.withdrawalAddress(w.address, depositAddress);
  const swap: SwapRecord = {
    kind: "return",
    depositAddress,
    amountIn: q.quote.amountIn,
    amountOut: q.quote.amountOut,
    minAmountOut: q.quote.minAmountOut,
    refundTo: w.address,
    recipient,
    timeEstimateSeconds: q.quote.timeEstimate + out.seconds,
    deadline: q.quote.deadline ?? q.quoteRequest.deadline,
    status: "QUOTED",
    createdAt: now,
    updatedAt: now,
    signedQuote: q,
  };
  w = advance(
    { ...(walletById(id) ?? w), swaps: [...w.swaps, swap] },
    "returning",
    now,
    `Sending ${cash.toFixed(2)} pUSD home`,
  );
  putWallet(w);
  await account.transfer("pusd", withdrawal, amount);
  const sent: PrivateWallet = walletById(id) ?? w;
  putWallet({
    ...withSwap(sent, "return", { status: "KNOWN_DEPOSIT_TX", depositTx: `bridge:${withdrawal}` }),
    timeline: [
      ...sent.timeline,
      { status: "returning", at: Date.now(), note: "Through Polymarket's bridge, then NEAR, back to ZEC" },
    ],
  });
  return { sent: cash };
}

/** A wallet has placed its first order: it is trading now. */
export function markTrading(id: string, note: string) {
  const w = walletById(id);
  if (!w || w.status === "trading") return;
  if (w.status === "ready") putWallet(advance(w, "trading", Date.now(), note));
}

/** Records a trade on its wallet (cost basis and history for the portfolio) and marks it trading. */
export function recordTrade(id: string, trade: TradeRecord) {
  markTrading(id, trade.label);
  const w = walletById(id);
  if (w) putWallet({ ...w, trades: [...(w.trades ?? []), trade] });
}

/**
 * Sends one Hyperliquid wallet's money home: gather its USDC in spot, take a signed 1Click quote
 * to a fresh shielded address (refunds go back to the wallet itself), save the quote, then send.
 * The ZEC that arrives rests 2–6 h before it can fund anything (it comes from a public address).
 */
export async function sendHyperliquidHome(id: string): Promise<{ sent: number }> {
  let w = walletById(id);
  if (w?.venue !== "hyperliquid") throw new Error("not a Hyperliquid wallet");
  if (w.status !== "ready" && w.status !== "trading" && w.status !== "failed") {
    throw new Error(`a ${w.status} wallet cannot be sent home`);
  }
  const account = await hlAccount(w);
  const amount = await account.consolidate(await hlMarket.perps());
  const now = Date.now();
  if (amount === 0) {
    w = advance(w, "returning", now, "Only dust is left");
    putWallet(advance(w, "retired", now, "Under 1 USDC stays: less than the trip home would cost"));
    return { sent: 0 };
  }
  const recipient = await freshAddress();
  const q = await quote({
    from: "hypercoreUsdc",
    to: "zec",
    amount: String(Math.round(amount * CENTS) * CENTS_TO_BASE),
    recipient,
    refundTo: w.address,
    dry: false,
  });
  const depositAddress = q.quote.depositAddress as `0x${string}` | undefined;
  if (!depositAddress) throw new Error("the quote has no deposit address");
  const swap: SwapRecord = {
    kind: "return",
    depositAddress,
    amountIn: q.quote.amountIn,
    amountOut: q.quote.amountOut,
    minAmountOut: q.quote.minAmountOut,
    refundTo: w.address,
    recipient,
    timeEstimateSeconds: q.quote.timeEstimate,
    deadline: q.quote.deadline ?? q.quoteRequest.deadline,
    status: "QUOTED",
    createdAt: now,
    updatedAt: now,
    signedQuote: q,
  };
  w = advance({ ...w, swaps: [...w.swaps, swap] }, "returning", now, `Sending ${amount.toFixed(2)} USDC home`);
  putWallet(w);
  await account.sendUsdc(depositAddress, amount);
  const sent: PrivateWallet = walletById(id) ?? w;
  putWallet({
    ...withSwap(sent, "return", { status: "KNOWN_DEPOSIT_TX", depositTx: "spotSend" }),
    timeline: [...sent.timeline, { status: "returning", at: Date.now(), note: "Swapping back to ZEC on NEAR" }],
  });
  return { sent: amount };
}

/**
 * Sends one Solana wallet's money home: every token is sold back to SOL, then a signed 1Click
 * quote (SOL to ZEC, to a fresh shielded address; refunds back to the wallet), then one transfer.
 */
export async function sendSolanaHome(id: string): Promise<{ sent: number }> {
  let w = walletById(id);
  if (w?.venue !== "solana") throw new Error("not a Solana wallet");
  if (w.status !== "ready" && w.status !== "trading" && w.status !== "failed") {
    throw new Error(`a ${w.status} wallet cannot be sent home`);
  }
  const account = await solAccount(w);
  for (const t of (await account.holdings()).tokens) await account.sell(t.mint);
  const lamports = await account.sendable();
  const now = Date.now();
  if (lamports === 0n) {
    w = advance(w, "returning", now, "Only dust is left");
    putWallet(advance(w, "retired", now, "What is left is less than the trip home would cost"));
    return { sent: 0 };
  }
  const recipient = await freshAddress();
  const q = await quote({
    from: "sol",
    to: "zec",
    amount: lamports.toString(),
    recipient,
    refundTo: w.address,
    dry: false,
  });
  const depositAddress = q.quote.depositAddress;
  if (!depositAddress) throw new Error("the quote has no deposit address");
  const swap: SwapRecord = {
    kind: "return",
    depositAddress,
    amountIn: q.quote.amountIn,
    amountOut: q.quote.amountOut,
    minAmountOut: q.quote.minAmountOut,
    refundTo: w.address,
    recipient,
    timeEstimateSeconds: q.quote.timeEstimate,
    deadline: q.quote.deadline ?? q.quoteRequest.deadline,
    status: "QUOTED",
    createdAt: now,
    updatedAt: now,
    signedQuote: q,
  };
  w = advance({ ...w, swaps: [...w.swaps, swap] }, "returning", now, "Sending SOL home");
  putWallet(w);
  const signature = await account.sendSol(depositAddress, lamports);
  const sent: PrivateWallet = walletById(id) ?? w;
  putWallet({
    ...withSwap(sent, "return", { status: "KNOWN_DEPOSIT_TX", depositTx: signature }),
    timeline: [...sent.timeline, { status: "returning", at: Date.now(), note: "Swapping back to ZEC on NEAR" }],
  });
  void oneclick.submitDeposit(depositAddress, signature).catch(() => undefined);
  return { sent: Number(lamports) };
}
