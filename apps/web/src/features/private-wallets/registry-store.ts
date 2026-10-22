"use client";

import { emptyRegistry, type PrivateWallet, type Registry } from "@mitoshi/engine";
import { useSyncExternalStore } from "react";
import { ZEC_NETWORK } from "@/constants";
import { vaultGet, vaultPut } from "../vault/vault";

/**
 * The private-wallet registry, held in memory and saved encrypted in the device vault after every
 * change (in order, so a later state never gets overwritten by an earlier one).
 */

let registry: Registry = emptyRegistry();
let loading: Promise<Registry> | null = null;
let saving: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function loadRegistry(): Promise<Registry> {
  loading ??= vaultGet(ZEC_NETWORK, "registry").then(
    (bytes) => {
      if (bytes) registry = { ...emptyRegistry(), ...(JSON.parse(new TextDecoder().decode(bytes)) as Registry) };
      emit();
      return registry;
    },
    (e: unknown) => {
      // A locked vault: try again once it is unlocked.
      loading = null;
      throw e;
    },
  );
  return loading;
}

export function currentRegistry(): Registry {
  return registry;
}

export function mutate(f: (r: Registry) => Registry): Registry {
  registry = f(registry);
  emit();
  const snapshot = new TextEncoder().encode(JSON.stringify(registry));
  saving = saving.then(() => vaultPut(ZEC_NETWORK, "registry", snapshot)).catch(() => undefined);
  return registry;
}

/**
 * Brings in wallets from elsewhere (a backup file, a recovery scan): new ones are added, known
 * ones kept, and each venue's next index moves past every index seen.
 */
export function mergeRegistry(incoming: Pick<Registry, "wallets"> & Partial<Registry>) {
  mutate((r) => {
    const known = new Set(r.wallets.map((w) => w.address.toLowerCase()));
    const added = incoming.wallets.filter((w) => !known.has(w.address.toLowerCase()));
    const wallets = [...r.wallets, ...added].sort((a, b) => b.createdAt - a.createdAt);
    const nextIndex = { ...r.nextIndex };
    for (const w of wallets) nextIndex[w.venue] = Math.max(nextIndex[w.venue], w.index + 1);
    return { ...r, wallets, nextIndex, keepReady: incoming.keepReady ?? r.keepReady };
  });
}

/** Replaces one wallet (matched by id). */
export function putWallet(w: PrivateWallet) {
  mutate((r) => ({ ...r, wallets: r.wallets.map((x) => (x.id === w.id ? w : x)) }));
}

export function walletById(id: string): PrivateWallet | undefined {
  return registry.wallets.find((w) => w.id === id);
}

export function useRegistry(): Registry {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => registry,
    () => registry,
  );
}
