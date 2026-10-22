"use client";

import { MNEMONIC_STRENGTH_BITS, type Summary, type SyncProgress, WalletClient } from "@mitoshi/zwallet";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { useSyncExternalStore } from "react";
import { IRONWOOD_ACTIVATION, LWD_BASE, WALLET_SYNC_INTERVAL_MS, ZEC_NETWORK } from "@/constants";
import { vaultGet, vaultPut } from "../vault/vault";

export type WalletPhase = "idle" | "loading" | "empty" | "creating" | "syncing" | "ready" | "error";

export interface WalletState {
  phase: WalletPhase;
  summary: Summary | null;
  progress: SyncProgress | null;
  error: string | null;
}

let state: WalletState = { phase: "idle", summary: null, progress: null, error: null };
const listeners = new Set<() => void>();
let client: WalletClient | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function set(patch: Partial<WalletState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
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

async function seedHex(): Promise<string> {
  const phrase = await vaultGet(ZEC_NETWORK, "mnemonic");
  if (!phrase) throw new Error("no wallet on this device");
  return toHex(mnemonicToSeedSync(new TextDecoder().decode(phrase)));
}

function fail(e: unknown) {
  set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
}

async function sync() {
  if (!client) return;
  set({ phase: state.summary ? "ready" : "syncing" });
  try {
    const summary = await client.sync();
    set({ phase: "ready", summary, progress: null, error: null });
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
    await client.open(ZEC_NETWORK, LWD_BASE, saved ?? undefined);
    const hasPhrase = (await vaultGet(ZEC_NETWORK, "mnemonic")) !== null;
    if (!hasPhrase) {
      set({ phase: "empty" });
      return;
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
  set({ phase: "idle", summary: null, progress: null, error: null });
}
