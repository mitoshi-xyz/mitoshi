import { type Registry, BLOCK_SECONDS as SPACING, type Venue as WalletVenue } from "@mitoshi/engine";
import { type HistoryEntry, OWN_CHANGE_CONFIRMATIONS, RECEIVED_CONFIRMATIONS, ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ArrowDownLeft, ArrowUpRight, Repeat, ShieldCheck, Undo2 } from "lucide-react";
import { ZEC_EXPLORER, ZEC_NETWORK } from "@/constants";
import type { Venue } from "../marks/mark";

/**
 * One transaction of the shielded wallet, read the same way everywhere it shows: the money card's confirming line, the
 * History list, the receipt and the notification that opens it.
 */

export const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 8;
const SECONDS_PER_MINUTE = 60;
const BLOCK_SECONDS = SPACING[ZEC_NETWORK];
const VENUE_NAMES: Record<WalletVenue, string> = {
  hyperliquid: "Hyperliquid",
  polymarket: "Polymarket",
  solana: "Solana",
};

/** ZEC with up to eight decimals, trailing zeros dropped. */
export const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

export interface TxStory {
  title: string;
  icon: typeof ArrowDownLeft;
  venue?: Venue;
  tone: "in" | "out" | "neutral";
  /** What to show as the amount, in zat: the change to the balance, or for a move between pools what moved. */
  amount: number;
  /** The amount is a move, not a gain or a loss: shown without a sign. */
  moved: boolean;
}

/** What a transaction was, in words, matched against the private wallets' swaps, exchange deposits and migrations. */
export function story(e: HistoryEntry, registry: Registry): TxStory {
  for (const w of registry.wallets) {
    for (const s of w.swaps) {
      if (s.kind === "fund" && s.depositTx === e.txid) {
        const title = `Funded a ${VENUE_NAMES[w.venue]} wallet`;
        return { title, icon: ArrowUpRight, venue: w.venue, tone: "out", amount: e.delta, moved: false };
      }
      if (s.kind === "return" && s.settledTx === e.txid) {
        const title = `Came home from ${VENUE_NAMES[w.venue]}`;
        return { title, icon: ArrowDownLeft, venue: w.venue, tone: "in", amount: e.delta, moved: false };
      }
      if (s.kind === "fund" && s.status === "REFUNDED" && s.settledTx === e.txid) {
        return { title: "Refund from NEAR", icon: Undo2, tone: "in", amount: e.delta, moved: false };
      }
    }
  }
  if (e.internal) {
    const fee = e.fee ?? 0;
    const deposit = registry.exchange?.find((a) => a.shieldTx === e.txid);
    if (deposit?.arrivedZat !== undefined || e.fromPublic) {
      const amount = deposit?.arrivedZat !== undefined ? deposit.arrivedZat - fee : Math.abs(e.delta);
      return { title: "Shielded", icon: ShieldCheck, tone: "neutral", amount, moved: deposit !== undefined };
    }
    const part = registry.migration?.find((p) => p.txid === e.txid);
    const amount = part ? part.zat : Math.abs(e.delta);
    return { title: "Moved between pools", icon: Repeat, tone: "neutral", amount, moved: part !== undefined };
  }
  return e.delta >= 0
    ? { title: "Received", icon: ArrowDownLeft, tone: "in", amount: e.delta, moved: false }
    : { title: "Sent", icon: ArrowUpRight, tone: "out", amount: e.delta, moved: false };
}

/** The amount as a row or receipt prints it: signed for gains and losses, plain for a move. */
export function signed(s: TxStory): string {
  if (s.moved) return zec(s.amount);
  return `${s.amount >= 0 ? "+" : "−"}${zec(Math.abs(s.amount))}`;
}

export interface Progress {
  /** Blocks on top of the transaction's own, counting it (0 until mined). */
  done: number;
  /** Blocks before the value is spendable: 10 for ZEC from others, 3 for the wallet's own change, 1 for a send. */
  need: number;
  settled: boolean;
  minutesLeft: number;
}

export function progress(e: HistoryEntry, tip: number | null): Progress {
  const need = e.internal ? OWN_CHANGE_CONFIRMATIONS : e.delta > 0 ? RECEIVED_CONFIRMATIONS : 1;
  const done = e.minedHeight !== null && tip !== null ? Math.max(0, tip - e.minedHeight + 1) : 0;
  const left = Math.max(0, need - done);
  return {
    done,
    need,
    settled: e.expired || left === 0,
    minutesLeft: Math.max(1, Math.ceil((left * BLOCK_SECONDS) / SECONDS_PER_MINUTE)),
  };
}

/** The status in a few words: waiting for a block, counting blocks, or confirmed. */
export function statusLine(e: HistoryEntry, p: Progress): string {
  if (e.expired) return "Expired · nothing moved";
  if (e.minedHeight === null) return "Waiting for a block";
  if (!p.settled) return `${p.done} of ${p.need} blocks`;
  return "Confirmed";
}

/** Value still on its way in: a deposit or a shielding the wallet counts toward spendable. */
export function arriving(e: HistoryEntry, tip: number | null): boolean {
  return !e.expired && (e.delta > 0 || e.internal) && !progress(e, tip).settled;
}

export const explorerUrl = (txid: string) => `${ZEC_EXPLORER[ZEC_NETWORK]}/transactions/${txid}`;
export const explorerHost = new URL(ZEC_EXPLORER[ZEC_NETWORK]).host;
