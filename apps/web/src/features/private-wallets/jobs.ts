"use client";

import {
  advance,
  checkFunding,
  fundingTime,
  isCanonical,
  type LeakReport,
  latestSwap,
  liveWallets,
  type PrivateWallet,
  type SwapRecord,
  type SwapStatus,
  type Venue,
  walletAddress,
} from "@mitoshi/engine";
import { ASSETS, type AssetKey, formatUnits, type QuoteResponse } from "@mitoshi/rails";
import { ZEC_NETWORK } from "@/constants";
import { deviceSeed, freshAddress, previewSend, refreshWallet, send, walletState } from "../wallet/wallet-store";
import { currentRegistry, mutate, putWallet, walletById } from "./registry-store";
import { oneclick, quote, withSwap } from "./swaps";

export { confidentialSwaps } from "./swaps";

/** What each venue's wallet is funded with on arrival. */
export const VENUE_ASSET: Record<Venue, AssetKey> = {
  polymarket: "polygonUsdc",
  hyperliquid: "hypercoreUsdc",
  solana: "sol",
};

const TICK_MS = 5_000;
const POLL_MS = 15_000;
/** A funding's network fee is checked for real before sending; this reserve is for showing sizes. */
export const FUNDING_FEE_RESERVE_ZAT = 15_000;

const TERMINAL: SwapStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];

export function canFund(): { ok: boolean; why?: string } {
  if (ZEC_NETWORK !== "main") {
    return { ok: false, why: "Private wallets are funded through NEAR Intents, which only takes mainnet ZEC." };
  }
  return { ok: true };
}

/** What the rested, spendable balance allows. */
export function balances() {
  const b = walletState().summary?.balance;
  return {
    spendable: b ? b.ironwood.spendable + b.orchard.spendable : 0,
    resting: b ? b.ironwood.locked + b.orchard.locked : 0,
  };
}

export interface FundingPreview {
  out: string;
  symbol: string;
  usd: string;
  seconds: number;
  quote: QuoteResponse;
  leak: LeakReport;
}

/** A dry quote for funding a new wallet of `sizeZat` on `venue` (nothing moves). */
export async function previewFunding(venue: Venue, sizeZat: number): Promise<FundingPreview> {
  const allowed = canFund();
  if (!allowed.ok) throw new Error(allowed.why);
  const seed = await deviceSeed();
  const recipient = walletAddress(seed, venue, currentRegistry().nextIndex[venue]);
  const refundTo = await freshAddress();
  const q = await quote({
    from: "zec",
    to: VENUE_ASSET[venue],
    amount: String(sizeZat),
    recipient,
    refundTo,
    dry: true,
    appFee: true,
  });
  const asset = ASSETS[VENUE_ASSET[venue]];
  const { spendable, resting } = balances();
  return {
    out: formatUnits(q.quote.amountOut, asset.decimals),
    symbol: asset.symbol,
    usd: q.quote.amountOutUsd,
    seconds: q.quote.timeEstimate,
    quote: q,
    leak: checkFunding({
      amountZat: sizeZat,
      feeZat: FUNDING_FEE_RESERVE_ZAT,
      spendableZat: spendable,
      restingZat: resting,
    }),
  };
}

/** Adds a wallet that will fund itself at a random moment in the next few minutes. */
export async function prepareWallet(venue: Venue, sizeZat: number): Promise<PrivateWallet> {
  const allowed = canFund();
  if (!allowed.ok) throw new Error(allowed.why);
  if (!isCanonical(sizeZat)) throw new Error("wallets are funded with standard sizes only");
  const seed = await deviceSeed();
  const index = currentRegistry().nextIndex[venue];
  const now = Date.now();
  const wallet: PrivateWallet = {
    id: crypto.randomUUID(),
    venue,
    index,
    address: walletAddress(seed, venue, index),
    sizeZat,
    status: "preparing",
    createdAt: now,
    timeline: [{ status: "preparing", at: now, note: "Waiting for a random moment to start" }],
    swaps: [],
    fundAt: fundingTime(now),
  };
  mutate((r) => ({ ...r, nextIndex: { ...r.nextIndex, [venue]: index + 1 }, wallets: [wallet, ...r.wallets] }));
  return wallet;
}

function fail(id: string, why: unknown) {
  const w = walletById(id);
  if (!w) return;
  const message = why instanceof Error ? why.message : String(why);
  try {
    putWallet({ ...advance(w, "failed", Date.now(), message), error: message });
  } catch {
    putWallet({ ...w, error: message });
  }
}

/**
 * Funds one wallet: a signed 1Click quote, one shielded payment of exactly the wallet's standard
 * size to the quote's deposit address (change stays shielded), then 1Click is told the txid.
 * The quote is saved before anything is sent, so a closed tab can always find the swap again.
 */
async function fund(id: string) {
  let w = walletById(id);
  if (w?.status !== "preparing") return;
  w = advance(w, "funding", Date.now(), "Getting a quote from NEAR Intents");
  putWallet(w);
  try {
    const refundTo = await freshAddress();
    const q = await quote({
      from: "zec",
      to: VENUE_ASSET[w.venue],
      amount: String(w.sizeZat),
      recipient: w.address,
      refundTo,
      dry: false,
      appFee: true,
    });
    const depositAddress = q.quote.depositAddress;
    if (!depositAddress) throw new Error("the quote has no deposit address");
    const proposal = await previewSend(depositAddress, w.sizeZat);
    const { spendable, resting } = balances();
    const leak = checkFunding({
      amountZat: w.sizeZat,
      feeZat: proposal.fee,
      spendableZat: spendable,
      restingZat: resting,
    });
    if (leak.level === "red")
      throw new Error(leak.reasons.find((r) => r.level === "red")?.text ?? "blocked by the leak meter");
    const now = Date.now();
    const swap: SwapRecord = {
      kind: "fund",
      depositAddress,
      amountIn: q.quote.amountIn,
      amountOut: q.quote.amountOut,
      minAmountOut: q.quote.minAmountOut,
      refundTo,
      recipient: w.address,
      timeEstimateSeconds: q.quote.timeEstimate,
      deadline: q.quote.deadline ?? q.quoteRequest.deadline,
      status: "QUOTED",
      createdAt: now,
      updatedAt: now,
      signedQuote: q,
    };
    w = { ...w, swaps: [...w.swaps, swap] };
    putWallet(w);
    const { txid } = await send(depositAddress, w.sizeZat);
    const sent = walletById(id) ?? w;
    putWallet({
      ...withSwap(sent, "fund", { status: "KNOWN_DEPOSIT_TX", depositTx: txid }),
      timeline: [...sent.timeline, { status: "funding", at: Date.now(), note: "Sent privately; swapping on NEAR" }],
    });
    void oneclick.submitDeposit(depositAddress, txid).catch(() => undefined);
  } catch (e) {
    fail(id, e);
  }
}

const arrivedNote = (w: PrivateWallet, settled: string | undefined) => {
  const asset = ASSETS[VENUE_ASSET[w.venue]];
  return settled ? `Arrived: ${formatUnits(settled, asset.decimals)} ${asset.symbol}` : "Arrived";
};

/** Follows a swap on 1Click and moves the wallet along when it settles. */
async function poll(id: string) {
  const w = walletById(id);
  if (!w) return;
  const kind = w.status === "returning" ? "return" : "fund";
  const swap = latestSwap(w, kind);
  if (!swap || TERMINAL.includes(swap.status) || Date.now() - swap.updatedAt < POLL_MS) return;
  const st = await oneclick.status(swap.depositAddress).catch(() => null);
  const now = Date.now();
  if (!st) {
    putWallet(withSwap(w, kind, {}));
    return;
  }
  let next = withSwap(w, kind, {
    status: st.status,
    ...(st.swapDetails.amountOut ? { settledOut: st.swapDetails.amountOut } : {}),
    ...(st.swapDetails.refundedAmount ? { refundedAmount: st.swapDetails.refundedAmount } : {}),
  });
  if (kind === "fund") {
    if (st.status === "SUCCESS") next = advance(next, "ready", now, arrivedNote(w, st.swapDetails.amountOut));
    if (st.status === "REFUNDED") {
      next = advance(next, "refunded", now, "NEAR refunded the swap; the ZEC is back in your balance (resting)");
      void refreshWallet();
    }
    if (st.status === "FAILED") next = advance(next, "failed", now, "NEAR could not complete the swap");
    if (st.status === "PENDING_DEPOSIT" && !swap.depositTx && Date.parse(swap.deadline) < now) {
      next = advance(next, "failed", now, "The deposit was never sent");
    }
  } else if (st.status === "SUCCESS") {
    next = advance(next, "retired", now, "Home: the ZEC is back in your balance (resting)");
    void refreshWallet();
  } else if (st.status === "REFUNDED" || st.status === "FAILED") {
    next = advance(next, "failed", now, "The trip home was refunded to the wallet; try again");
  }
  putWallet(next);
}

const running = new Set<string>();

function once(id: string, job: (id: string) => Promise<void>) {
  if (running.has(id)) return;
  running.add(id);
  void job(id).finally(() => running.delete(id));
}

/** Tops up "keep one ready": a venue with a size set and no live wallet gets a new one. */
function keepReady() {
  const r = currentRegistry();
  const { spendable } = balances();
  for (const venue of Object.keys(r.keepReady) as Venue[]) {
    const size = r.keepReady[venue];
    if (!size || liveWallets(r, venue).some((w) => w.status !== "trading")) continue;
    if (size + FUNDING_FEE_RESERVE_ZAT > spendable) continue;
    void prepareWallet(venue, size).catch(() => undefined);
  }
}

function tick() {
  if (walletState().phase !== "ready") return;
  const now = Date.now();
  for (const w of currentRegistry().wallets) {
    if (w.status === "preparing" && (w.fundAt ?? 0) <= now) once(w.id, fund);
    if (w.status === "funding" || w.status === "returning") once(w.id, poll);
  }
  if (canFund().ok) keepReady();
}

let started = false;

/** Runs the private-wallet jobs while the app is open (once per page). */
export function startJobs() {
  if (started) return;
  started = true;
  setInterval(tick, TICK_MS);
}

export function setKeepReady(venue: Venue, sizeZat: number | null) {
  mutate((r) => ({ ...r, keepReady: { ...r.keepReady, [venue]: sizeZat } }));
}
