"use client";

import { useEffect } from "react";
import { ZEC_NETWORK } from "@/constants";
import { Onboarding } from "@/features/wallet/onboarding";
import { WalletHome } from "@/features/wallet/wallet-home";
import { bootWallet, useWallet } from "@/features/wallet/wallet-store";

export default function WalletPage() {
  const state = useWallet();
  useEffect(() => {
    void bootWallet();
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex items-baseline justify-between">
        <h1 className="font-semibold text-2xl">Wallet</h1>
        <span className="text-xs opacity-60">{ZEC_NETWORK === "main" ? "Zcash mainnet" : "Zcash testnet"}</span>
      </header>
      {state.phase === "idle" || state.phase === "loading" ? (
        <p className="opacity-70">Loading the private wallet engine…</p>
      ) : null}
      {state.phase === "empty" ? <Onboarding /> : null}
      {state.phase === "creating" ? <p className="opacity-70">Creating your wallet…</p> : null}
      {state.phase === "syncing" || state.phase === "ready" ? <WalletHome state={state} /> : null}
      {state.phase === "error" ? <p className="text-red-400">{state.error}</p> : null}
    </main>
  );
}
