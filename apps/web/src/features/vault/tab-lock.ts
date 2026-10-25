"use client";

import { useSyncExternalStore } from "react";
import { dbName } from "./vault";

/**
 * One tab holds the wallet. Two tabs on one vault would each run the engine and the jobs: the last to save a wallet
 * file would overwrite the other's, and a funding that came due could go out from both. So the first tab takes a Web
 * Lock named after the vault and keeps it while open; another tab waits, says so, and can take the wallet over (the
 * first tab then lets go of it: its engine stops and it says the wallet moved).
 */
export type TabOwner = "unknown" | "mine" | "elsewhere";

let owner: TabOwner = "unknown";
const listeners = new Set<() => void>();
let onLost: (() => void) | null = null;
let claiming: Promise<boolean> | null = null;

function setOwner(next: TabOwner) {
  owner = next;
  for (const l of listeners) l();
}

const lockName = () => `${dbName()}:open`;

/**
 * Takes the wallet for this tab if no other tab has it (or, with `steal`, from the tab that has it). Resolves true
 * when this tab holds it. A browser without Web Locks has no other tab to fear: it always holds it.
 */
export function claimTab(steal = false): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    setOwner("mine");
    return Promise.resolve(true);
  }
  // This page asks once (an effect run twice, a second component): a second request would wait on its own lock.
  if (claiming && !steal) return claiming;
  claiming = new Promise((resolve) => {
    const options: LockOptions = steal ? { steal: true } : { ifAvailable: true };
    navigator.locks
      .request(lockName(), options, (lock) => {
        if (!lock) {
          setOwner("elsewhere");
          resolve(false);
          return undefined;
        }
        setOwner("mine");
        resolve(true);
        // Held for as long as this page is open.
        return new Promise<void>(() => undefined);
      })
      .catch(() => {
        // Another tab took the wallet over.
        setOwner("elsewhere");
        claiming = Promise.resolve(false);
        onLost?.();
      });
  });
  return claiming;
}

/** What to do when another tab takes the wallet (stop the engine). */
export function onTabLost(f: () => void) {
  onLost = f;
}

export function useTabOwner(): TabOwner {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => owner,
    () => "unknown",
  );
}
