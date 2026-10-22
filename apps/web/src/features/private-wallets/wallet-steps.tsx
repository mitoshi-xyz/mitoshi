"use client";

import { latestSwap, type PrivateWallet, type SwapRecord, ZAT_PER_ZEC } from "@mitoshi/engine";
import { ASSETS, formatUnits } from "@mitoshi/rails";
import { CountdownRing, type TxStep, Wait } from "@/kit";
import { VENUE_ASSET } from "./jobs";
import { VENUES } from "./venues";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const PROOF_SECONDS = 20;
const TXID_HEAD = 10;
const ZEC_DIGITS = 8;
const ASSET_DIGITS = 4;
/** Where a funding is, by step index. */
const STAGE = { waiting: 0, proof: 1, swapping: 3, done: 5 } as const;

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

export function inMinutes(ms: number): string {
  const m = Math.round(ms / MS_PER_SECOND / SECONDS_PER_MINUTE);
  return m <= 0 ? "under a minute" : m === 1 ? "about 1 min" : `about ${m} min`;
}

/** An amount of what a venue wallet holds, in its own units ("41.2031 USDC"). */
export function venueAmount(w: PrivateWallet, base: string): string {
  const asset = ASSETS[VENUE_ASSET[w.venue]];
  const n = Number(formatUnits(base, asset.decimals));
  return `${n.toFixed(ASSET_DIGITS).replace(/\.?0+$/, "")} ${asset.symbol}`;
}

/** A countdown against a swap's own time estimate. */
function SwapEta({ swap, now, words }: { swap: SwapRecord; now: number; words: string }) {
  const total = swap.timeEstimateSeconds * MS_PER_SECOND;
  const left = swap.createdAt + total - now;
  return (
    <span className="flex items-center gap-2">
      <CountdownRing fraction={total > 0 ? left / total : 0} size={14} />
      <span>
        {words} · {left > 0 ? `${inMinutes(left)} left` : "any moment now"}
      </span>
    </span>
  );
}

const SWAP_WORDS: Partial<Record<SwapRecord["status"], string>> = {
  KNOWN_DEPOSIT_TX: "NEAR has the deposit",
  PENDING_DEPOSIT: "Waiting for the deposit to confirm",
  INCOMPLETE_DEPOSIT: "The deposit came in short",
  PROCESSING: "Swapping",
};

/**
 * A wallet's funding as steps: waiting for its random start, the private proof, sent, the NEAR
 * swap (with a countdown from 1Click's own estimate), arrived, ready. A failure or refund marks
 * the step where it happened and says what moved.
 */
export function fundingSteps(w: PrivateWallet, now: number): TxStep[] {
  const swap = latestSwap(w, "fund");
  const sent = Boolean(swap?.depositTx);
  const settled = swap?.status === "SUCCESS";
  const venue = VENUES[w.venue].name;
  const stage = w.status === "preparing" ? STAGE.waiting : !sent ? STAGE.proof : !settled ? STAGE.swapping : STAGE.done;
  const failed = w.status === "failed";
  const refunded = w.status === "refunded";
  const state = (i: number): TxStep["state"] => {
    if ((failed || refunded) && i === stage) return "failed";
    if (i < stage) return "done";
    if (i === stage) return stage === STAGE.done ? "done" : "active";
    return "pending";
  };
  const steps: TxStep[] = [
    {
      label: "Waiting for a random moment to start",
      state: state(STAGE.waiting),
      ...(stage === STAGE.waiting && w.fundAt
        ? {
            detail: (
              <span className="flex items-center gap-2">
                <CountdownRing fraction={(w.fundAt - now) / Math.max(1, w.fundAt - w.createdAt)} size={14} />
                Starts in {inMinutes(w.fundAt - now)}, so the start can't be matched to anything you did
              </span>
            ),
          }
        : {}),
    },
    {
      label: "Making the private proof",
      state: state(STAGE.proof),
      ...(stage === STAGE.proof && !failed
        ? {
            detail: swap ? (
              <Wait verb="Proving in this browser" expectSeconds={PROOF_SECONDS} />
            ) : (
              <Wait verb="Getting a price from NEAR Intents" />
            ),
          }
        : stage === STAGE.proof && failed
          ? { detail: `${w.error ?? "Stopped"}. Nothing was sent: your ZEC is where it was.` }
          : {}),
    },
    {
      label: `Sent ${zec(w.sizeZat)} ZEC privately`,
      state: sent ? "done" : "pending",
      ...(swap?.depositTx ? { detail: `${swap.depositTx.slice(0, TXID_HEAD)}… · one standard-size payment` } : {}),
    },
    {
      label: "Swapping on NEAR Intents",
      state: state(STAGE.swapping),
      ...(stage === STAGE.swapping && swap && !failed && !refunded
        ? { detail: <SwapEta swap={swap} now={now} words={SWAP_WORDS[swap.status] ?? "Swapping"} /> }
        : stage === STAGE.swapping && refunded
          ? { detail: "NEAR refunded the swap" }
          : stage === STAGE.swapping && failed
            ? { detail: w.error ?? "NEAR could not complete the swap" }
            : {}),
    },
  ];
  if (refunded) {
    steps.push({
      label: "Back in your balance",
      state: "done",
      detail: swap?.refundedAmount
        ? `${zec(Number(swap.refundedAmount))} ZEC, resting 2–6 h like any public arrival`
        : "Resting 2–6 h like any public arrival",
    });
    return steps;
  }
  steps.push(
    {
      label: `Arrived on ${venue}`,
      state: settled ? "done" : "pending",
      ...(settled && swap?.settledOut ? { detail: venueAmount(w, swap.settledOut) } : {}),
    },
    { label: "Ready to trade", state: settled ? "done" : "pending" },
  );
  return steps;
}

/** The trip home as steps: sent to NEAR, swapped back to ZEC, home and shielded (resting). */
export function homeSteps(w: PrivateWallet, now: number): TxStep[] {
  const swap = latestSwap(w, "return");
  if (!swap) {
    return [
      {
        label: "Only dust was left",
        state: "done",
        detail: w.timeline.at(-1)?.note ?? "Less than the trip home costs",
      },
    ];
  }
  const sent = Boolean(swap.depositTx);
  const home = swap.status === "SUCCESS";
  const failed = w.status === "failed";
  return [
    { label: "Price from NEAR Intents", state: "done", detail: `${venueAmount(w, swap.amountIn)} in` },
    {
      label: "Sent to the swap",
      state: sent ? "done" : failed ? "failed" : "active",
      ...(failed && !sent ? { detail: `${w.error ?? "Stopped"}. The money is still in this wallet.` } : {}),
    },
    {
      label: "Swapping back to ZEC",
      state: home ? "done" : !sent ? "pending" : failed ? "failed" : "active",
      ...(sent && !home && !failed
        ? { detail: <SwapEta swap={swap} now={now} words={SWAP_WORDS[swap.status] ?? "Swapping"} /> }
        : sent && failed
          ? { detail: `${w.error ?? "NEAR refunded it"}. The money went back to this wallet.` }
          : {}),
    },
    {
      label: "Home, shielded",
      state: home ? "done" : "pending",
      ...(home && swap.settledOut
        ? { detail: `+${zec(Number(swap.settledOut))} ZEC · rests 2–6 h, then it's yours to use` }
        : {}),
    },
  ];
}
