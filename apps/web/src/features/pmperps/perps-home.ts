"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { pmMarket } from "../polymarket/pm";
import { ppAccount, ppMarket } from "./pp";

const WITHDRAW_POLL_MS = 5_000;
const WITHDRAW_TRIES = 72;
/** A withdrawal counts as arrived once the Deposit Wallet holds this share of it (rounding). */
const ARRIVED_SHARE = 0.99;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Brings a Polymarket wallet's Perps money back to its Deposit Wallet before the trip home:
 * open orders cancelled, every position closed (refused otherwise), the withdrawable pUSD
 * withdrawn by the owner's signature, then waited for on Polygon. A wallet that never opened a
 * Perps account has nothing to do.
 */
export async function bringPerpsHome(w: PrivateWallet, step: (s: string) => void = () => {}): Promise<number> {
  const perps = await ppAccount(w);
  if (!(await ppMarket.registered(perps.address))) return 0;
  const amount = await perps.consolidate();
  if (amount <= 0) return 0;
  const before = await pmMarket.pusd(w.address);
  step(`Withdrawing ${amount.toFixed(2)} pUSD from Polymarket Perps`);
  await perps.withdraw(amount, w.address as `0x${string}`);
  for (let i = 0; i < WITHDRAW_TRIES; i++) {
    await sleep(WITHDRAW_POLL_MS);
    if ((await pmMarket.pusd(w.address)) >= before + amount * ARRIVED_SHARE) return amount;
  }
  throw new Error("the Perps withdrawal has not reached the wallet yet; try again in a few minutes");
}
