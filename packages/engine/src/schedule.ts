import { FUND_DELAY_MAX_MS, FUND_DELAY_MIN_MS } from "./constants.ts";
import { between, cryptoRandom } from "./random.ts";

/**
 * When a wallet that is due should start funding: a random moment 20 s to 3 min out. Fundings are
 * never sent the instant a deposit lands or the app opens, so the public hop's timing does not
 * point back at either event.
 */
export function fundingTime(now: number, rand: () => number = cryptoRandom): number {
  return now + between(FUND_DELAY_MIN_MS, FUND_DELAY_MAX_MS, rand);
}
