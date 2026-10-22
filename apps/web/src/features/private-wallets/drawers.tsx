"use client";

import type { Venue } from "@mitoshi/engine";
import { useSyncExternalStore } from "react";
import { FundDrawer } from "./fund-drawer";
import { PublicView } from "./public-view";
import { useRegistry } from "./registry-store";

/**
 * The private-wallet drawers, open from anywhere: "Fund a private wallet" on a ticket opens the
 * Fund drawer right there (venue already chosen), and any wallet can show what the public sees.
 * The shell renders them once.
 */
interface DrawerState {
  fund: Venue | null;
  publicId: string | null;
}

let state: DrawerState = { fund: null, publicId: null };
const listeners = new Set<() => void>();

function set(next: DrawerState) {
  state = next;
  for (const l of listeners) l();
}

export function openFund(venue: Venue = "polymarket") {
  set({ ...state, fund: venue });
}

export function openPublicView(id: string) {
  set({ fund: null, publicId: id });
}

function useDrawers(): DrawerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

let lastVenue: Venue = "polymarket";

export function WalletDrawers() {
  const s = useDrawers();
  const registry = useRegistry();
  if (s.fund) lastVenue = s.fund;
  return (
    <>
      <FundDrawer
        open={s.fund !== null}
        venue={lastVenue}
        onClose={() => set({ ...state, fund: null })}
        onPublic={openPublicView}
      />
      <PublicView
        wallet={registry.wallets.find((w) => w.id === s.publicId) ?? null}
        onClose={() => set({ ...state, publicId: null })}
      />
    </>
  );
}
