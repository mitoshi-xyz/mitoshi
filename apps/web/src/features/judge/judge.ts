"use client";

import { useMemo, useSyncExternalStore } from "react";
import { JUDGE_HOST, ZEC_NETWORK } from "@/constants";
import { hlMarket } from "../hyperliquid/hl";
import { forgetVault, vaultGet, vaultPut } from "../vault/vault";
import { type DeskBundle, type DeskIndex, fromBase64 } from "./desk";
import { setupSlot } from "./slot";

/**
 * Judge mode: the app on judge.mitoshi.xyz, holding one of the six desks. Everything works as on mitoshi.xyz, with
 * three differences: no deposits into a desk, no "keep one ready" (a desk never funds anything by itself), and a path
 * that shows a judge the product in four steps.
 */

const DESK_STORE = "mitoshi:desk";
const PATH_STORE = "mitoshi:desk-path";

/** On judge.mitoshi.xyz (or a developer's "judge" frame, so the flow can be tried locally). */
export function onJudgeHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === JUDGE_HOST || setupSlot() === "judge";
}

/** {@link onJudgeHost} for rendering: false on the server's pass, so the static page hydrates the same. */
export function useOnJudgeHost(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    onJudgeHost,
    () => false,
  );
}

const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function readDesk(): number | null {
  if (!onJudgeHost()) return null;
  try {
    const n = Number(localStorage.getItem(DESK_STORE));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The desk this browser holds, or null (not on the judge host, or no desk opened yet). */
export function useJudgeDesk(): number | null {
  return useSyncExternalStore(subscribe, readDesk, () => null);
}

export const judgeDesk = readDesk;

export type PathStep = "trade" | "public" | "fund" | "home";

function readPath(): string {
  try {
    return localStorage.getItem(PATH_STORE) ?? "[]";
  } catch {
    return "[]";
  }
}

function parsePath(raw: string): PathStep[] {
  try {
    return JSON.parse(raw) as PathStep[];
  } catch {
    return [];
  }
}

/** Notes a path step a judge has looked at (the ones the registry can't tell, like opening the public view). */
export function markStep(step: PathStep) {
  if (!onJudgeHost()) return;
  try {
    const seen = new Set(parsePath(readPath()));
    if (seen.has(step)) return;
    seen.add(step);
    localStorage.setItem(PATH_STORE, JSON.stringify([...seen]));
    emit();
  } catch {
    // Storage blocked: the step simply stays unticked.
  }
}

export function useSeenSteps(): PathStep[] {
  const raw = useSyncExternalStore(subscribe, readPath, () => "[]");
  return useMemo(() => parsePath(raw), [raw]);
}

/** Whether this origin's vault already holds a wallet (a desk opened before, in this browser). */
export async function holdsWallet(): Promise<boolean> {
  return (await vaultGet(ZEC_NETWORK, "mnemonic").catch(() => null)) !== null;
}

export type DeskCheck = "checking" | "free" | "used";

/**
 * Finds a desk nobody has traded from yet, by its Hyperliquid wallet's public footprint (no desk is opened to look),
 * in a random order so two judges arriving together rarely pick the same one. With all six used, the least used.
 */
export async function pickDesk(
  index: DeskIndex,
  onCheck: (n: number, state: DeskCheck) => void,
): Promise<{ n: number; shared: boolean }> {
  // A Fisher–Yates shuffle: every order equally likely.
  const order = [...index.desks];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j] as (typeof order)[number], order[i] as (typeof order)[number]];
  }
  let least: { n: number; activity: number } | null = null;
  for (const d of order) {
    onCheck(d.n, "checking");
    const f = await hlMarket.footprint(d.hyperliquid as `0x${string}`);
    const used = f.activity > 0 || (f.openPositions ?? 0) > 0;
    onCheck(d.n, used ? "used" : "free");
    if (!used) return { n: d.n, shared: false };
    if (!least || f.activity < least.activity) least = { n: d.n, activity: f.activity };
  }
  if (!least) throw new Error("There are no desks");
  return { n: least.n, shared: true };
}

/** Writes a desk's records into this origin's vault. The next page load opens it like any wallet. */
export async function importDesk(bundle: DeskBundle) {
  const encode = (t: string) => new TextEncoder().encode(t);
  // A desk never funds anything on its own, and its setup notices count as new for the judge.
  const registry = { ...bundle.registry, keepReady: {}, noticesSeenAt: 0 };
  await vaultPut(ZEC_NETWORK, "walletdb", fromBase64(bundle.walletdb));
  await vaultPut(ZEC_NETWORK, "registry", encode(JSON.stringify(registry)));
  await vaultPut(ZEC_NETWORK, "pending", new Uint8Array());
  await vaultPut(ZEC_NETWORK, "mnemonic", encode(bundle.mnemonic));
  localStorage.setItem(DESK_STORE, String(bundle.n));
  localStorage.removeItem(PATH_STORE);
  emit();
}

/** Gives the desk back: this browser forgets it (the desk itself stays as it is, for whoever opens it next). */
export async function leaveDesk() {
  await forgetVault();
  try {
    localStorage.removeItem(DESK_STORE);
    localStorage.removeItem(PATH_STORE);
  } catch {
    // Nothing more to clear.
  }
  window.location.assign("/");
}
