"use client";

import { BLOCK_SECONDS, planRest, restEndsAt, restKey } from "@mitoshi/engine";
import {
  type HistoryEntry,
  MNEMONIC_STRENGTH_BITS,
  type Note,
  type Summary,
  type SyncProgress,
  WalletClient,
} from "@mitoshi/zwallet";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { useSyncExternalStore } from "react";
import { IRONWOOD_ACTIVATION, RELAY, WALLET_SYNC_INTERVAL_MS, ZEC_NETWORK } from "@/constants";
import { vaultGet, vaultPut } from "../vault/vault";

export type WalletPhase = "idle" | "loading" | "empty" | "creating" | "syncing" | "ready" | "error";

export interface WalletState {
  phase: WalletPhase;
  summary: Summary | null;
  progress: SyncProgress | null;
  error: string | null;
  notes: Note[];
  history: HistoryEntry[];
  /** When the soonest resting value becomes usable (ms since the epoch), if any is resting. */
  restingUntil: number | null;
}

const INITIAL: WalletState = {
  phase: "idle",
  summary: null,
  progress: null,
  error: null,
  notes: [],
  history: [],
  restingUntil: null,
};

let state: WalletState = INITIAL;
const listeners = new Set<() => void>();
let client: WalletClient | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function set(patch: Partial<WalletState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

/** The current wallet state, outside React. */
export function walletState(): WalletState {
  return state;
}

export function useWallet(): WalletState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

const HEX_RADIX = 16;
const HEX_CHARS_PER_BYTE = 2;
const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(HEX_RADIX).padStart(HEX_CHARS_PER_BYTE, "0")).join("");

/** The 64-byte BIP 39 seed. It is read from the vault each time and never kept around. */
export async function deviceSeed(): Promise<Uint8Array> {
  const phrase = await vaultGet(ZEC_NETWORK, "mnemonic");
  if (!phrase) throw new Error("no wallet on this device");
  return mnemonicToSeedSync(new TextDecoder().decode(phrase));
}

async function seedHex(): Promise<string> {
  return toHex(await deviceSeed());
}

/** The rest key (derived from the seed); kept for the session, it reveals nothing about the seed. */
let restKeyBytes: Uint8Array | null = null;
/** Locks applied this session, so a sync only touches notes whose plan changed. */
const applied = new Map<string, number>();
const refKey = (n: { txid: string; pool: string; index: number }) => `${n.txid}:${n.pool}:${n.index}`;

/**
 * The rest rules, applied after every sync: value from a public address is locked in the wallet
 * store until its rest ends; fully shielded value is free at once.
 */
async function applyRest(c: WalletClient, tip: number) {
  restKeyBytes ??= restKey(await deviceSeed());
  const notes = await c.notes();
  const blockSeconds = BLOCK_SECONDS[ZEC_NETWORK];
  const plan = planRest(notes, tip, restKeyBytes, blockSeconds);
  let soonest: number | null = null;
  for (const lock of plan.lock) {
    const fresh = lock.notes.filter((n) => applied.get(refKey(n)) !== lock.untilHeight);
    if (fresh.length) await c.lockNotes(fresh, lock.untilHeight);
    for (const n of lock.notes) applied.set(refKey(n), lock.untilHeight);
    const ends = restEndsAt(lock.untilHeight, tip, Date.now(), blockSeconds);
    soonest = soonest === null ? ends : Math.min(soonest, ends);
  }
  const released = plan.unlock.filter((n) => applied.has(refKey(n)));
  if (released.length) {
    await c.unlockNotes(released);
    for (const n of released) applied.delete(refKey(n));
  }
  return { notes, restingUntil: soonest };
}

function fail(e: unknown) {
  set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
}

async function sync() {
  if (!client) return;
  set({ phase: state.summary ? "ready" : "syncing" });
  try {
    const c = client;
    let summary = await c.sync();
    let rest: { notes: Note[]; restingUntil: number | null } = { notes: state.notes, restingUntil: state.restingUntil };
    if (summary.tip !== null) {
      rest = await applyRest(c, summary.tip);
      summary = await c.summary();
    }
    const history = await c.history();
    set({ phase: "ready", summary, progress: null, error: null, history, ...rest });
  } catch (e) {
    fail(e);
  }
}

function startSyncing() {
  void sync();
  timer ??= setInterval(() => void sync(), WALLET_SYNC_INTERVAL_MS);
}

/** Opens the wallet engine with whatever this device has saved. Safe to call more than once. */
export async function bootWallet() {
  if (state.phase !== "idle") return;
  set({ phase: "loading" });
  try {
    client = new WalletClient({
      onProgress: (progress) => set({ progress }),
      onPersist: (bytes) => void vaultPut(ZEC_NETWORK, "walletdb", bytes),
    });
    const saved = await vaultGet(ZEC_NETWORK, "walletdb");
    await client.open(ZEC_NETWORK, RELAY, saved ?? undefined);
    const hasPhrase = (await vaultGet(ZEC_NETWORK, "mnemonic")) !== null;
    if (!hasPhrase) {
      set({ phase: "empty" });
      return;
    }
    // Show what this device already knows straight away; the sync then brings it to the tip.
    try {
      set({ phase: "ready", summary: await client.summary() });
    } catch {
      // A wallet that never finished its first sync has no summary yet.
    }
    startSyncing();
    void client.warmProver();
  } catch (e) {
    fail(e);
  }
}

/** A new 24-word recovery phrase. Nothing is stored until {@link createWallet}. */
export function newPhrase(): string {
  return generateMnemonic(wordlist, MNEMONIC_STRENGTH_BITS);
}

export function isValidPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase().split(/\s+/).join(" "), wordlist);
}

/** Saves the phrase (encrypted) and creates the wallet. `restore` scans from Ironwood's activation. */
export async function createWallet(phrase: string, restore: boolean) {
  if (!client) return;
  const normalized = phrase.trim().toLowerCase().split(/\s+/).join(" ");
  set({ phase: "creating", error: null });
  try {
    await vaultPut(ZEC_NETWORK, "mnemonic", new TextEncoder().encode(normalized));
    const seed = toHex(mnemonicToSeedSync(normalized));
    await client.create(seed, restore ? IRONWOOD_ACTIVATION[ZEC_NETWORK] : undefined);
    startSyncing();
    void client.warmProver();
  } catch (e) {
    fail(e);
  }
}

export async function freshAddress(): Promise<string> {
  if (!client) throw new Error("wallet is not open");
  return (await client.freshAddress()).address;
}

/** The open wallet engine, for the private-wallet jobs. */
export function walletClient(): WalletClient {
  if (!client) throw new Error("wallet is not open");
  return client;
}

/** Brings the balance up to date now (after a send or a payout). */
export function refreshWallet(): Promise<void> {
  return sync();
}

export async function previewSend(to: string, zat: number) {
  if (!client) throw new Error("wallet is not open");
  return client.propose(to, zat);
}

/** Proves, signs and broadcasts a payment, then refreshes the balance. */
export async function send(to: string, zat: number): Promise<{ txid: string; fee: number }> {
  if (!client) throw new Error("wallet is not open");
  const result = await client.send(to, zat, await seedHex());
  void sync();
  return result;
}

/** Stops syncing and closes the wallet engine (used by Forget). */
export function stopWallet() {
  if (timer) clearInterval(timer);
  timer = null;
  client?.close();
  client = null;
  restKeyBytes = null;
  applied.clear();
  set(INITIAL);
}
