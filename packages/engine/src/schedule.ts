import { FUND_DELAY_MAX_MS, FUND_DELAY_MIN_MS, REFILL_MAX_MS, REFILL_MEAN_MS } from "./constants.ts";
import { between, cryptoRandom } from "./random.ts";

/**
 * When a wallet that is due should start funding: a random moment 20 s to 3 min out. Fundings are
 * never sent the instant a deposit lands or the app opens, so the public hop's timing does not
 * point back at either event.
 */
export function fundingTime(now: number, rand: () => number = cryptoRandom): number {
  return now + between(FUND_DELAY_MIN_MS, FUND_DELAY_MAX_MS, rand);
}

/**
 * When a keep-ready refill should start funding. It is needed because a ready wallet was just used, so a short delay
 * would put a fresh same-size wallet on the venue minutes after each first trade and chain a user's wallets together.
 * The delay is exponential (memoryless: how long ago the trade was says nothing about when the refill comes), mean
 * 90 min, between 20 s and 12 h.
 */
export function refillTime(now: number, rand: () => number = cryptoRandom): number {
  const delay = -Math.log(1 - rand()) * REFILL_MEAN_MS;
  return now + Math.round(Math.min(REFILL_MAX_MS, Math.max(FUND_DELAY_MIN_MS, delay)));
}

/** A new start for a funding that came due while the app was closed: sending it at once would time it to the app opening. */
export function retimed(now: number, refill: boolean, rand: () => number = cryptoRandom): number {
  return refill ? refillTime(now, rand) : fundingTime(now, rand);
}
