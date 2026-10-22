"use client";

import { AppShell } from "@/features/shell/app-shell";
import { Onboarding } from "@/features/wallet/onboarding";
import { WalletHome } from "@/features/wallet/wallet-home";
import { useWallet } from "@/features/wallet/wallet-store";

export default function WalletPage() {
  const state = useWallet();
  return (
    <AppShell>
      {state.phase === "idle" || state.phase === "loading" ? (
        <p className="opacity-70">Loading the private wallet engine…</p>
      ) : null}
      {state.phase === "empty" ? <Onboarding /> : null}
      {state.phase === "creating" ? <p className="opacity-70">Creating your wallet…</p> : null}
      {state.phase === "syncing" || state.phase === "ready" ? <WalletHome state={state} /> : null}
      {state.phase === "error" ? <p className="text-red-400">{state.error}</p> : null}
    </AppShell>
  );
}
