"use client";

import { advance, type PrivateWallet, type SwapRecord, type TradeRecord } from "@mitoshi/engine";
import { ASSETS } from "@mitoshi/rails";
import { hlAccount, hlMarket } from "../hyperliquid/hl";
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
  return Promise.reject(new Error("Polymarket wallets come home through the Polymarket bridge, with trading"));
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
    appFee: false,
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
    appFee: false,
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
