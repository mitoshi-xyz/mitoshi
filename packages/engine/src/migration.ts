import {
  CROSSING_FEE_ZAT,
  DECADE,
  DENOMINATION_DIGITS,
  MAX_DENOMINATION_ZAT,
  MIN_DENOMINATION_ZAT,
  TRANSFER_DELAY_CAP_MS,
  TRANSFER_DELAY_MEAN_MS,
} from "./constants.ts";
import { cryptoRandom } from "./random.ts";

/**
 * Moving Orchard value into Ironwood the way ZIP 318 (draft, zips.z.cash/zip-0318) specifies, so the only thing a
 * crossing publishes is a standard amount at a random time, the same as every other migrating wallet's.
 *
 * A payment never spends Orchard notes beside Ironwood ones: that would publish the crossing's value next to the
 * payment. Orchard value waits here instead, split into parts that each cross alone (the wallet core refuses any part
 * that would not be a canonical crossing).
 */

/** Every denomination from 0.01 to 10,000 ZEC, largest first. */
const DENOMINATIONS: readonly number[] = (() => {
  const out: number[] = [];
  for (let unit = MIN_DENOMINATION_ZAT; unit <= MAX_DENOMINATION_ZAT; unit *= DECADE) {
    for (const n of DENOMINATION_DIGITS) if (n * unit <= MAX_DENOMINATION_ZAT) out.push(n * unit);
  }
  return out.reverse();
})();

/** Splits a value into denominations, largest first (the same parts as ZIP 318's digit-by-digit expansion). */
export function canonicalParts(zat: number): number[] {
  const parts: number[] = [];
  let rest = zat;
  for (const d of DENOMINATIONS) {
    while (rest >= d) {
      parts.push(d);
      rest -= d;
    }
  }
  return parts;
}

/**
 * The parts that move a wallet's Orchard notes across, each paid for by its own note so every part spends exactly one
 * note (each part costs the crossing fee on top). What can't make a part stays behind as the residual.
 */
export function migrationParts(noteValues: number[]): { parts: number[]; residual: number } {
  const parts: number[] = [];
  let residual = 0;
  for (const value of noteValues) {
    let fees = 1;
    let mine = canonicalParts(value - CROSSING_FEE_ZAT);
    // Every part pays its own fee: grow the fee budget until the parts it leaves room for need no more.
    while (mine.length > fees) {
      fees = mine.length;
      mine = canonicalParts(value - fees * CROSSING_FEE_ZAT);
    }
    const used = mine.reduce((n, p) => n + p, 0) + mine.length * CROSSING_FEE_ZAT;
    parts.push(...mine);
    residual += value - (mine.length ? used : 0);
  }
  return { parts, residual };
}

/** One exponential delay between transfers, clamped to the cap. */
export function transferDelay(rand: () => number = cryptoRandom): number {
  return Math.round(Math.min(TRANSFER_DELAY_CAP_MS, -Math.log(1 - rand()) * TRANSFER_DELAY_MEAN_MS));
}

/** The parts in random order, each at its own time: an exponential delay after the one before it. */
export function migrationSchedule(
  parts: number[],
  now: number,
  rand: () => number = cryptoRandom,
): { zat: number; at: number }[] {
  const order = parts.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  let at = now;
  return order.map((zat) => {
    at += transferDelay(rand);
    return { zat, at };
  });
}
