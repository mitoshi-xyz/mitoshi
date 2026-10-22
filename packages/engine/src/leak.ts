import { NEAR_MATCH_FRACTION, PAYOUT_MEMORY_MS, TIMING_WINDOW_MS, ZAT_PER_ZEC } from "./constants.ts";
import { isCanonical } from "./denominations.ts";

export type Level = "green" | "amber" | "red";

export interface LeakReport {
  level: Level;
  reasons: { level: Level; text: string }[];
}

const RANK: Record<Level, number> = { green: 0, amber: 1, red: 2 };

function report(reasons: LeakReport["reasons"]): LeakReport {
  const level = reasons.reduce<Level>((worst, r) => (RANK[r.level] > RANK[worst] ? r.level : worst), "green");
  return { level, reasons };
}

const ZEC_DECIMALS = 8;
const zec = (zat: number) => `${(zat / ZAT_PER_ZEC).toFixed(ZEC_DECIMALS).replace(/\.?0+$/, "")} ZEC`;

export interface FundingCheck {
  amountZat: number;
  feeZat: number;
  /** Spendable now: rested or fully shielded value only (resting notes are locked). */
  spendableZat: number;
  restingZat: number;
}

/** The meter for funding a private wallet. */
export function checkFunding(c: FundingCheck): LeakReport {
  const reasons: LeakReport["reasons"] = [];
  if (!isCanonical(c.amountZat)) {
    reasons.push({
      level: "red",
      text: `${zec(c.amountZat)} is not a standard size, so the public hop would stand out`,
    });
  } else {
    reasons.push({ level: "green", text: `${zec(c.amountZat)} is a standard size shared by many swaps` });
  }
  if (c.amountZat + c.feeZat > c.spendableZat) {
    const why = c.restingZat > 0 ? ` (${zec(c.restingZat)} is still resting after arriving from a public address)` : "";
    reasons.push({ level: "red", text: `not enough rested balance${why}` });
  }
  return report(reasons);
}

export interface Payout {
  zat: number;
  at: number;
}

export interface WithdrawalCheck {
  amountZat: number;
  /** Whether the destination is a shielded address (amounts and addresses stay private). */
  shielded: boolean;
  now: number;
  /** ZEC that came home to this wallet from private wallets (NEAR payouts). */
  payouts: Payout[];
}

/** The meter for sending ZEC out of Mitoshi. */
export function checkWithdrawal(c: WithdrawalCheck): LeakReport {
  if (c.shielded) {
    return report([{ level: "green", text: "Shielded to shielded: the amount and both addresses stay private" }]);
  }
  const reasons: LeakReport["reasons"] = [];
  const recent = c.payouts.filter((p) => c.now - p.at <= PAYOUT_MEMORY_MS);
  for (const p of recent) {
    const diff = Math.abs(p.zat - c.amountZat);
    if (diff === 0) {
      reasons.push({ level: "red", text: `exactly matches ${zec(p.zat)} that came home from a private wallet` });
    } else if (diff <= p.zat * NEAR_MATCH_FRACTION) {
      reasons.push({ level: "amber", text: `close to ${zec(p.zat)} that came home from a private wallet` });
    }
    if (c.now - p.at <= TIMING_WINDOW_MS) {
      reasons.push({ level: "amber", text: "soon after a payout: waiting a few hours breaks the timing link" });
    }
  }
  if (!isCanonical(c.amountZat)) {
    reasons.push({ level: "amber", text: "a round, standard amount blends in better on a public address" });
  }
  if (reasons.length === 0) reasons.push({ level: "green", text: "no recent payout matches this amount or time" });
  return report(reasons);
}
