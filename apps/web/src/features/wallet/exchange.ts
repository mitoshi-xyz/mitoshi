"use client";

import { between, type ExchangeAddress, fundingTime, ZAT_PER_ZEC } from "@mitoshi/engine";
import { EXCHANGE_CHECK_MAX_MS, EXCHANGE_CHECK_MIN_MS, EXCHANGE_WATCH_MS } from "@/constants";
import { toast } from "@/kit";
import { currentRegistry, mutate } from "../private-wallets/registry-store";
import { refreshWallet, shieldTransparent, walletClient, walletState } from "./wallet-store";

const ZEC_DIGITS = 8;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

function put(a: ExchangeAddress) {
  mutate((r) => ({ ...r, exchange: [a, ...(r.exchange ?? []).filter((x) => x.address !== a.address)] }));
}

/**
 * The address to show for an exchange deposit: one whose deposit is still on its way into the shielded pool, else the
 * newest one while nothing has arrived at it (so reopening Deposit does not burn addresses), otherwise a fresh
 * transparent address of this wallet.
 */
export async function exchangeAddress(): Promise<ExchangeAddress> {
  const all = currentRegistry().exchange ?? [];
  // A deposit on its way into the shielded pool stays on screen until it gets there.
  const inFlight = all.find((a) => a.arrivedZat !== undefined && a.shieldTx === undefined);
  if (inFlight) return inFlight;
  const newest = all[0];
  if (newest && newest.arrivedZat === undefined && Date.now() - newest.createdAt < EXCHANGE_WATCH_MS) return newest;
  return freshExchangeAddress();
}

/** A new transparent address for the next deposit (the drawer's "New address"). */
export async function freshExchangeAddress(): Promise<ExchangeAddress> {
  const { address } = await walletClient().transparentAddress();
  const a: ExchangeAddress = { address, createdAt: Date.now() };
  put(a);
  return a;
}

let nextCheckAt = 0;
let turn = 0;
let busy = false;
let shieldAt: number | null = null;

/** Checks this address on the next round (the drawer asks when it opens, so a deposit shows up quickly). */
export function checkSoon() {
  nextCheckAt = 0;
}

/**
 * Runs from the jobs tick. One watched address is checked per round, a random 45–120 s apart, each in its own sealed
 * request; what arrives is shielded at a random moment a little later, never the instant it is seen.
 */
export function exchangeTick(now: number) {
  if (busy) return;
  const watched = (currentRegistry().exchange ?? []).filter(
    (a) => a.shieldTx === undefined && now - a.createdAt < EXCHANGE_WATCH_MS,
  );
  const waiting = walletState().summary?.balance?.transparent.spendable ?? 0;
  if (waiting > 0 && shieldAt === null) shieldAt = fundingTime(now);
  if (shieldAt !== null && now >= shieldAt) {
    busy = true;
    void shield().finally(() => {
      busy = false;
    });
    return;
  }
  if (watched.length === 0 || now < nextCheckAt) return;
  const a = watched[turn % watched.length];
  turn += 1;
  if (!a) return;
  busy = true;
  nextCheckAt = now + between(EXCHANGE_CHECK_MIN_MS, EXCHANGE_CHECK_MAX_MS);
  void walletClient()
    .checkUtxos(a.address)
    .then(async (found) => {
      const { error: _cleared, ...ok } = a;
      if (found.zat <= 0 || a.arrivedZat === found.zat) {
        put({ ...ok, checkedAt: Date.now() });
        return;
      }
      put({ ...ok, checkedAt: Date.now(), arrivedZat: found.zat, arrivedAt: a.arrivedAt ?? Date.now() });
      toast({
        tone: "up",
        title: `${zec(found.zat)} ZEC arrived from your exchange`,
        body: "Moving it into the shielded pool.",
        action: { label: "See it", href: "/portfolio" },
      });
      await refreshWallet();
    })
    .catch((e: unknown) => put({ ...a, checkedAt: Date.now(), error: e instanceof Error ? e.message : String(e) }))
    .finally(() => {
      busy = false;
    });
}

async function shield() {
  try {
    const done = await shieldTransparent();
    shieldAt = null;
    if (!done.txid) return;
    const at = Date.now();
    for (const a of currentRegistry().exchange ?? []) {
      if (a.arrivedZat !== undefined && a.shieldTx === undefined) put({ ...a, shieldTx: done.txid, shieldedAt: at });
    }
    toast({
      tone: "up",
      title: "Moved into the shielded pool",
      body: "Spendable after 10 blocks, then it rests 2–6 h.",
      action: { label: "See it", href: "/portfolio" },
    });
  } catch (e) {
    // Not confirmed enough yet, or the light server is away: say so, and try again at a new random moment.
    shieldAt = fundingTime(Date.now());
    const why = e instanceof Error ? e.message : String(e);
    for (const a of currentRegistry().exchange ?? []) {
      if (a.arrivedZat !== undefined && a.shieldTx === undefined) put({ ...a, error: why });
    }
  }
}
