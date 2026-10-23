"use client";

import { BLOCK_SECONDS, between, planRest, restEndsAt, restKey } from "@mitoshi/engine";
import {
  type EngineLoad,
  type HistoryEntry,
  MNEMONIC_STRENGTH_BITS,
  type Note,
  type Summary,
  type SyncProgress,
  WalletClient,
  ZAT_PER_ZEC,
} from "@mitoshi/zwallet";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { useSyncExternalStore } from "react";
import {
  IRONWOOD_ACTIVATION,
  RELAY,
  SEND_QUIET_MAX_MS,
  SEND_QUIET_MIN_MS,
  WALLET_SYNC_INTERVAL_MS,
  ZEC_NETWORK,
} from "@/constants";
import { toast } from "@/kit";
import { currentRegistry } from "../private-wallets/registry-store";
import { vaultGet, vaultLockState, vaultPut } from "../vault/vault";

export type WalletPhase = "idle" | "loading" | "locked" | "empty" | "creating" | "syncing" | "ready" | "error";

/** What creating a wallet is doing right now: saving the words, then making the account. */
export type CreatingStep = "vault" | "account";

export interface WalletState {
  phase: WalletPhase;
  /** The engine download while it runs (null before it starts and once it is open). */
  engine: EngineLoad | null;
  creatingStep: CreatingStep | null;
  summary: Summary | null;
  progress: SyncProgress | null;
  /** The engine failed to open or create: nothing else works until a reload. */
  error: string | null;
  /** The last sync failed (network, light server); the wallet still works and the next sync retries. */
  syncError: string | null;
  /** When the last sync finished cleanly (ms since the epoch). */
  syncedAt: number | null;
  notes: Note[];
  history: HistoryEntry[];
  /** When the soonest resting value becomes usable (ms since the epoch), if any is resting. */
  restingUntil: number | null;
  /** When that value arrived (ms since the epoch), so its rest can be shown as a share done. */
  restingFrom: number | null;
}

const INITIAL: WalletState = {
  phase: "idle",
  engine: null,
  creatingStep: null,
  summary: null,
  progress: null,
  error: null,
  syncError: null,
  syncedAt: null,
  notes: [],
  history: [],
  restingUntil: null,
  restingFrom: null,
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

const MS_PER_SECOND = 1000;
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
  const mined = new Map(notes.map((n) => [refKey(n), n.minedHeight ?? tip]));
  const now = Date.now();
  let soonest: { until: number; from: number } | null = null;
  for (const lock of plan.lock) {
    const fresh = lock.notes.filter((n) => applied.get(refKey(n)) !== lock.untilHeight);
    if (fresh.length) await c.lockNotes(fresh, lock.untilHeight);
    for (const n of lock.notes) applied.set(refKey(n), lock.untilHeight);
    const until = restEndsAt(lock.untilHeight, tip, now, blockSeconds);
    if (soonest === null || until < soonest.until) {
      const arrived = Math.min(...lock.notes.map((n) => mined.get(refKey(n)) ?? tip));
      soonest = { until, from: now - (tip - arrived) * blockSeconds * MS_PER_SECOND };
    }
  }
  const released = plan.unlock.filter((n) => applied.has(refKey(n)));
  if (released.length) {
    await c.unlockNotes(released);
    for (const n of released) applied.delete(refKey(n));
  }
  return { notes, restingUntil: soonest?.until ?? null, restingFrom: soonest?.from ?? null };
}

const ZEC_DIGITS = 8;
const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const fmt = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

/**
 * Toasts for what a sync turned up: a deposit that arrived, a withdrawal that confirmed. Money
 * moved by private wallets (fundings, trips home) is announced by their own jobs instead.
 */
function announce(before: HistoryEntry[], after: HistoryEntry[]) {
  const seen = new Map(before.map((h) => [h.txid, h]));
  const swaps = currentRegistry().wallets.flatMap((w) => w.swaps);
  const ours = (txid: string) => swaps.some((s) => s.depositTx === txid || s.settledTx === txid);
  for (const h of after) {
    if (h.internal || ours(h.txid)) continue;
    const old = seen.get(h.txid);
    if (!old && h.delta > 0) {
      toast({
        tone: "up",
        title: `Deposit arrived: +${fmt(h.delta)} ${UNIT}`,
        body: h.fromPublic ? "From a public address: it rests 2–6 h first." : "Shielded. It confirms in a block.",
        action: { label: "Balance", href: "/wallet" },
      });
    } else if (old && old.minedHeight === null && h.minedHeight !== null && h.delta < 0) {
      toast({
        tone: "up",
        title: `Withdrawal confirmed: ${fmt(-h.delta)} ${UNIT}`,
        action: { label: "Receipt", href: "/wallet" },
      });
    }
  }
}

function fail(e: unknown) {
  set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
}

/** No sync before this moment: it follows a broadcast (SEND_QUIET_MIN_MS). */
let quietUntil = 0;

async function sync() {
  if (!client || Date.now() < quietUntil) return;
  set({ phase: state.summary ? "ready" : "syncing" });
  try {
    const c = client;
    let summary = await c.sync();
    let rest: Pick<WalletState, "notes" | "restingUntil" | "restingFrom"> = {
      notes: state.notes,
      restingUntil: state.restingUntil,
      restingFrom: state.restingFrom,
    };
    if (summary.tip !== null) {
      rest = await applyRest(c, summary.tip);
      summary = await c.summary();
    }
    const history = await c.history();
    if (state.syncedAt !== null) announce(state.history, history);
    set({ phase: "ready", summary, progress: null, syncError: null, syncedAt: Date.now(), history, ...rest });
  } catch (e) {
    // A failed sync is not a broken wallet: keep what we know and let the next round retry.
    set({ progress: null, syncError: e instanceof Error ? e.message : String(e) });
  }
}

function startSyncing() {
  void sync();
  timer ??= setInterval(() => void sync(), WALLET_SYNC_INTERVAL_MS);
}

/** Opens the wallet engine with whatever this device has saved. Safe to call more than once. */
export async function bootWallet() {
  if (state.phase !== "idle" && state.phase !== "locked") return;
  set({ phase: "loading" });
  try {
    // A passphrase-locked vault opens nothing until it is unlocked (the engine included).
    const lock = await vaultLockState();
    if (lock.lockOn && !lock.unlocked) {
      set({ phase: "locked" });
      return;
    }
    client = new WalletClient({
      onProgress: (progress) => set({ progress }),
      onLoad: (engine) => set({ engine }),
      onPersist: (bytes) => void vaultPut(ZEC_NETWORK, "walletdb", bytes),
    });
    const saved = await vaultGet(ZEC_NETWORK, "walletdb");
    await client.open(ZEC_NETWORK, RELAY, saved ?? undefined);
    set({ engine: null });
    const phrase = await vaultGet(ZEC_NETWORK, "mnemonic");
    if (!phrase) {
      set({ phase: "empty" });
      return;
    }
    const pending = new TextDecoder().decode((await vaultGet(ZEC_NETWORK, "pending")) ?? new Uint8Array());
    if (pending === "new" || pending === "restore") {
      await makeAccount(new TextDecoder().decode(phrase), pending === "restore");
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
  set({ phase: "creating", creatingStep: "vault", error: null });
  try {
    // The words first: whatever happens next, they are what recovers the money.
    const encode = (t: string) => new TextEncoder().encode(t);
    await vaultPut(ZEC_NETWORK, "pending", encode(restore ? "restore" : "new"));
    await vaultPut(ZEC_NETWORK, "mnemonic", encode(normalized));
  } catch (e) {
    fail(e);
    return;
  }
  await makeAccount(normalized, restore);
}

/** Makes the shielded account from saved words, then starts syncing. Safe to resume. */
async function makeAccount(phrase: string, restore: boolean) {
  if (!client) return;
  set({ phase: "creating", creatingStep: "account", error: null });
  try {
    // A resumed run may find the account already made (only clearing the marker was lost).
    const made = (await client.summary().catch(() => null))?.birthday != null;
    if (!made)
      await client.create(toHex(mnemonicToSeedSync(phrase)), restore ? IRONWOOD_ACTIVATION[ZEC_NETWORK] : undefined);
    await vaultPut(ZEC_NETWORK, "pending", new Uint8Array());
    set({ creatingStep: null });
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

/**
 * Proves, signs and broadcasts a payment. The engine marks the spend at once, so the balance is right without a sync,
 * and the next sync waits a random 1–10 min instead of following the broadcast.
 */
export async function send(to: string, zat: number): Promise<{ txid: string; fee: number }> {
  if (!client) throw new Error("wallet is not open");
  const result = await client.send(to, zat, await seedHex());
  quietUntil = Date.now() + between(SEND_QUIET_MIN_MS, SEND_QUIET_MAX_MS);
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
