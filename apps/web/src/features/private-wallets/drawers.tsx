"use client";

import type { Venue } from "@mitoshi/engine";
import { useEffect, useSyncExternalStore } from "react";
import { DepositDrawer } from "../wallet/deposit-drawer";
import { WithdrawDrawer } from "../wallet/withdraw-drawer";
import { FundDrawer } from "./fund-drawer";
import { PublicView } from "./public-view";
import { useRegistry } from "./registry-store";

/**
 * The money drawers, open from anywhere and rendered once by the shell: Deposit, Withdraw, Fund a private wallet
 * (venue already chosen) and what the public sees of a wallet. A flow never leaves the screen it started on; links can
 * open one with "#deposit" or "#withdraw" on any page.
 */
interface DrawerState {
  fund: Venue | null;
  publicId: string | null;
  deposit: boolean;
  withdraw: boolean;
}

const CLOSED: DrawerState = { fund: null, publicId: null, deposit: false, withdraw: false };
let state: DrawerState = CLOSED;
const listeners = new Set<() => void>();

function set(next: DrawerState) {
  state = next;
  for (const l of listeners) l();
}

export function openFund(venue: Venue = "polymarket") {
  set({ ...CLOSED, fund: venue });
}

export function openPublicView(id: string) {
  set({ ...CLOSED, publicId: id });
}

export function openDeposit() {
  set({ ...CLOSED, deposit: true });
}

export function openWithdraw() {
  set({ ...CLOSED, withdraw: true });
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

const HASH_DRAWERS: Record<string, () => void> = { "#deposit": openDeposit, "#withdraw": openWithdraw };

let lastVenue: Venue = "polymarket";

export function WalletDrawers() {
  const s = useDrawers();
  const registry = useRegistry();
  if (s.fund) lastVenue = s.fund;

  useEffect(() => {
    const read = () => {
      const open = HASH_DRAWERS[window.location.hash];
      if (!open) return;
      open();
      history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

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
      <DepositDrawer open={s.deposit} onClose={() => set({ ...state, deposit: false })} />
      <WithdrawDrawer open={s.withdraw} onClose={() => set({ ...state, withdraw: false })} />
    </>
  );
}
