"use client";

import {
  advance,
  checkFunding,
  fundingTime,
  isCanonical,
  latestSwap,
  liveWallets,
  type PrivateWallet,
  refillTime,
  retimed,
  type SwapRecord,
  type SwapStatus,
  type Venue,
} from "@mitoshi/engine";
import { ASSETS, formatUnits } from "@mitoshi/rails";
import { toast } from "@/kit";
import { judgeDesk } from "../judge/judge";
import { pmBridge } from "../polymarket/pm";
import { exchangeTick } from "../wallet/exchange";
import { deviceSeed, freshAddress, previewSend, refreshWallet, send, walletState } from "../wallet/wallet-store";
import {
  balances,
  canFund,
  FUNDING_FEE_RESERVE_ZAT,
  fundingRecipient,
  routedQuote,
  VENUE_ASSET,
  venueAddress,
} from "./funding";
import { migrationTick } from "./migration";
import { currentRegistry, mutate, putWallet, walletById } from "./registry-store";
import { oneclick, withSwap } from "./swaps";
import { VENUES } from "./venues";

export {
  balances,
  canFund,
  FUNDING_FEE_RESERVE_ZAT,
  type FundingPreview,
  previewFunding,
  VENUE_ASSET,
  venueAddress,
} from "./funding";
export { type SwapMode, swapMode } from "./swaps";

const TICK_MS = 5_000;
const POLL_MS = 15_000;
const TERMINAL: SwapStatus[] = ["SUCCESS", "REFUNDED", "FAILED"];

/**
 * Adds a wallet that will fund itself at a random moment: within a few minutes when a trade asked for it, or after a
 * long random delay when "keep one ready" is replacing a wallet that was just used (`refill`).
 */
export async function prepareWallet(venue: Venue, sizeZat: number, refill = false): Promise<PrivateWallet> {
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
    address: venueAddress(seed, venue, index),
    sizeZat,
    status: "preparing",
    createdAt: now,
    timeline: [{ status: "preparing", at: now, note: "Waiting for a random moment to start" }],
    swaps: [],
    fundAt: refill ? refillTime(now) : fundingTime(now),
    ...(refill ? { refill } : {}),
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
    const recipient = await fundingRecipient(w);
    const { q, to } = await routedQuote(w.venue, {
      from: "zec",
      amount: String(w.sizeZat),
      recipient,
      refundTo,
      dry: false,
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
      recipient,
      timeEstimateSeconds: q.quote.timeEstimate,
      deadline: q.quote.deadline ?? q.quoteRequest.deadline,
      status: "QUOTED",
      asset: to,
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

/** The Zcash transaction NEAR settled a swap with (a refund or the trip home), for its notice to open. */
function receiptOf(w: PrivateWallet, kind: "fund" | "return"): { receipt: string } | { href: string } {
  const tx = w.swaps.find((s) => s.kind === kind)?.settledTx;
  return tx ? { receipt: tx } : { href: "/portfolio" };
}

function announceReady(w: PrivateWallet, body: string) {
  const venue = VENUES[w.venue];
  toast({
    tone: "up",
    title: `${venue.name} wallet ready`,
    body,
    href: venue.trade.href,
  });
}

const BRIDGE_DONE = "COMPLETED";
const BRIDGE_FAILED = "FAILED";

/**
 * Polymarket's last funding leg: the USDC NEAR delivered to the wallet's bridge address becomes
 * pUSD in the Deposit Wallet. The wallet is ready once the bridge says COMPLETED.
 */
async function credit(id: string) {
  const w = walletById(id);
  const swap = w ? latestSwap(w, "fund") : undefined;
  if (!w || !swap || w.status !== "funding" || swap.status !== "SUCCESS") return;
  if (swap.bridge && Date.now() - swap.updatedAt < POLL_MS) return;
  const t = await pmBridge.latest(swap.recipient).catch(() => null);
  const now = Date.now();
  let next = withSwap(w, "fund", t ? { bridge: { status: t.status, ...(t.txHash ? { txHash: t.txHash } : {}) } } : {});
  if (t?.status === BRIDGE_DONE) {
    next = advance(next, "ready", now, "Credited on Polymarket as pUSD");
    announceReady(w, "Credited on Polymarket as pUSD");
  } else if (t?.status === BRIDGE_FAILED) {
    next = advance(next, "failed", now, "Polymarket's bridge could not credit the funding");
    toast({
      tone: "down",
      title: "Polymarket funding stuck",
      body: "At Polymarket's bridge",
      href: "/wallets",
    });
  }
  putWallet(next);
}

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
    ...(st.swapDetails.destinationChainTxHashes[0]
      ? { settledTx: st.swapDetails.destinationChainTxHashes[0].hash }
      : {}),
    ...(st.swapDetails.refundedAmount ? { refundedAmount: st.swapDetails.refundedAmount } : {}),
  });
  const venue = VENUES[w.venue];
  if (kind === "fund") {
    // On Polymarket, NEAR's delivery is only the USDC at the bridge: the bridge leg finishes it.
    if (st.status === "SUCCESS" && w.venue === "polymarket") {
      next = {
        ...next,
        timeline: [...next.timeline, { status: "funding", at: now, note: arrivedNote(w, st.swapDetails.amountOut) }],
      };
    } else if (st.status === "SUCCESS") {
      next = advance(next, "ready", now, arrivedNote(w, st.swapDetails.amountOut));
      announceReady(w, arrivedNote(w, st.swapDetails.amountOut));
    }
    if (st.status === "REFUNDED") {
      next = advance(next, "refunded", now, "NEAR refunded the swap; the ZEC is back in your balance (resting)");
      toast({
        tone: "info",
        title: "NEAR refunded a funding",
        body: "Back in your balance · rests 2–6 h",
        ...receiptOf(next, "fund"),
      });
      void refreshWallet();
    }
    if (st.status === "FAILED") {
      next = advance(next, "failed", now, "NEAR could not complete the swap");
      toast({
        tone: "down",
        title: `${venue.name} funding stopped`,
        body: "NEAR couldn't finish the swap",
        href: "/wallets",
      });
    }
    if (st.status === "PENDING_DEPOSIT" && !swap.depositTx && Date.parse(swap.deadline) < now) {
      next = advance(next, "failed", now, "The deposit was never sent");
    }
  } else if (st.status === "SUCCESS") {
    next = advance(next, "retired", now, "Home: the ZEC is back in your balance (resting)");
    toast({
      tone: "up",
      title: `Home from ${venue.name}`,
      body: "Back in your balance · rests 2–6 h",
      ...receiptOf(next, "return"),
    });
    void refreshWallet();
  } else if (st.status === "REFUNDED" || st.status === "FAILED") {
    next = advance(next, "failed", now, "The trip home was refunded to the wallet; try again");
    toast({
      tone: "down",
      title: `Trip home from ${venue.name} refunded`,
      body: "Tap to try again",
      href: "/wallets",
    });
  }
  putWallet(next);
}

const running = new Set<string>();

function once(id: string, job: (id: string) => Promise<void>) {
  if (running.has(id)) return;
  running.add(id);
  void job(id).finally(() => running.delete(id));
}

/** Venues whose switch is making their first wallet right now, so a tick doesn't make a second. */
const starting = new Set<Venue>();

/** Whether "keep one ready" should add a wallet on a venue: a size set, none waiting, and the ZEC to fund it. */
function wantsWallet(venue: Venue, size: number | null | undefined): size is number {
  if (!size || starting.has(venue)) return false;
  if (liveWallets(currentRegistry(), venue).some((w) => w.status !== "trading")) return false;
  return size + FUNDING_FEE_RESERVE_ZAT <= balances().spendable;
}

/**
 * Tops up "keep one ready" in the background. These top-ups wait the long refill delay, so a refill never
 * follows the trade that used the last wallet.
 */
function keepReady() {
  const r = currentRegistry();
  for (const venue of Object.keys(r.keepReady) as Venue[]) {
    const size = r.keepReady[venue];
    if (wantsWallet(venue, size)) void prepareWallet(venue, size, true).catch(() => undefined);
  }
}

/** When this app session's jobs began. A funding due before then came due while the app was closed. */
let sessionStart = 0;

function tick() {
  if (walletState().phase !== "ready") return;
  const now = Date.now();
  for (const w of currentRegistry().wallets) {
    const due = w.status === "preparing" && (w.fundAt ?? 0) <= now;
    // Sending it now would time the public hop to the app opening: it gets a new random start instead.
    if (due && (w.fundAt ?? 0) < sessionStart) putWallet({ ...w, fundAt: retimed(now, w.refill === true) });
    else if (due) once(w.id, fund);
    if (w.status === "funding" || w.status === "returning") once(w.id, poll);
    if (w.status === "funding" && w.venue === "polymarket") once(`${w.id}:bridge`, () => credit(w.id));
  }
  // A judge's desk never starts a funding by itself: only a judge's own tap does.
  if (canFund().ok && judgeDesk() === null) keepReady();
  migrationTick(now, sessionStart);
  exchangeTick(now);
}

let started = false;

/** Runs the private-wallet jobs while the app is open (once per page). */
export function startJobs() {
  if (started) return;
  started = true;
  sessionStart = Date.now();
  setInterval(tick, TICK_MS);
}

/**
 * Picks a stopped wallet back up where it stopped. Before anything was sent it waits for a new
 * random start; after the deposit went out it goes back to following the swap on NEAR.
 */
export function retryWallet(id: string) {
  const w = walletById(id);
  // A stopped trip home is retried by sending home again (home.ts), not from here.
  if (w?.status !== "failed" || latestSwap(w, "return")) return;
  const now = Date.now();
  const { error: _cleared, ...rest } = w;
  if (latestSwap(w, "fund")?.depositTx) {
    putWallet(advance(rest, "funding", now, "Checking the swap on NEAR again"));
    return;
  }
  putWallet({
    ...advance(rest, "preparing", now, "Trying again at a new random moment"),
    fundAt: retimed(now, w.refill === true),
  });
}

export function setKeepReady(venue: Venue, sizeZat: number | null) {
  mutate((r) => ({ ...r, keepReady: { ...r.keepReady, [venue]: sizeZat } }));
  // Turning it on is a request, like tapping Fund: the first wallet starts at an ordinary random moment.
  if (!canFund().ok || !wantsWallet(venue, sizeZat)) return;
  starting.add(venue);
  void prepareWallet(venue, sizeZat)
    .catch(() => undefined)
    .finally(() => starting.delete(venue));
}
