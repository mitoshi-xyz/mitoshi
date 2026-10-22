"use client";

import { type PrivateWallet, type Venue, walletAddress } from "@mitoshi/engine";
import { useSyncExternalStore } from "react";
import { hlMarket } from "../hyperliquid/hl";
import { solMarket } from "../solana/sol";
import { deviceSeed } from "../wallet/wallet-store";
import { currentRegistry, mergeRegistry } from "./registry-store";

/** Venues whose wallets can be found from the words alone (Polymarket comes with its trading). */
const SCANNED: Venue[] = ["hyperliquid", "solana"];
/** Stop a venue after this many unused addresses in a row. */
const GAP = 5;
/**
 * One address at a time, a random 3–9 s apart: a venue that saw one gateway ask about a run of
 * addresses in a burst could guess they belong together.
 */
const DELAY_MIN_MS = 3_000;
const DELAY_SPREAD_MS = 6_000;

const pause = () =>
  new Promise((r) =>
    setTimeout(r, DELAY_MIN_MS + ((crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % DELAY_SPREAD_MS)),
  );

export interface RecoveryProgress {
  venue: Venue;
  index: number;
  checked: number;
  found: number;
}

async function used(venue: Venue, address: string): Promise<number | null> {
  const f =
    venue === "hyperliquid" ? await hlMarket.footprint(address as `0x${string}`) : await solMarket.footprint(address);
  return f.firstSeen ?? (f.activity > 0 || (f.transfers ?? 0) > 0 ? Date.now() : null);
}

/**
 * Finds the private wallets these words have made, by deriving each venue's addresses in order
 * and asking the venue (over OHTTP) whether each was ever used, until a run of unused ones.
 * Found wallets join the list as "trading" (they have a history), ready to be sent home.
 */
export async function recoverWallets(onProgress: (p: RecoveryProgress) => void, signal?: AbortSignal): Promise<number> {
  const seed = await deviceSeed();
  const known = new Set(currentRegistry().wallets.map((w) => w.address.toLowerCase()));
  const found: PrivateWallet[] = [];
  let checked = 0;
  for (const venue of SCANNED) {
    let misses = 0;
    for (let index = 0; misses < GAP; index++) {
      if (signal?.aborted) return found.length;
      const address = walletAddress(seed, venue, index);
      onProgress({ venue, index, checked, found: found.length });
      if (known.has(address.toLowerCase())) {
        misses = 0;
        continue;
      }
      if (checked > 0) await pause();
      const firstSeen = await used(venue, address);
      checked++;
      if (firstSeen === null) {
        misses++;
        continue;
      }
      misses = 0;
      const now = Date.now();
      found.push({
        id: crypto.randomUUID(),
        venue,
        index,
        address,
        sizeZat: 0,
        status: "trading",
        createdAt: firstSeen,
        timeline: [{ status: "trading", at: now, note: "Found again from your recovery words" }],
        swaps: [],
        recovered: true,
      });
      mergeRegistry({ wallets: found });
    }
  }
  onProgress({ venue: SCANNED.at(-1) ?? "solana", index: -1, checked, found: found.length });
  return found.length;
}

/** The recovery scan, run once at a time, followed from anywhere (Settings shows it). */
export interface RecoveryState {
  running: boolean;
  progress: RecoveryProgress | null;
  result: number | null;
  error: string | null;
}

let recovery: RecoveryState = { running: false, progress: null, result: null, error: null };
const listeners = new Set<() => void>();
const setRecovery = (patch: Partial<RecoveryState>) => {
  recovery = { ...recovery, ...patch };
  for (const l of listeners) l();
};

export function startRecovery() {
  if (recovery.running) return;
  setRecovery({ running: true, progress: null, result: null, error: null });
  recoverWallets((progress) => setRecovery({ progress })).then(
    (result) => setRecovery({ running: false, result }),
    (e: unknown) => setRecovery({ running: false, error: e instanceof Error ? e.message : String(e) }),
  );
}

export function useRecovery(): RecoveryState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => recovery,
    () => recovery,
  );
}
