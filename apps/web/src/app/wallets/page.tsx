"use client";

import Link from "next/link";
import { PrivateWallets } from "@/features/private-wallets/private-wallets";
import { AppShell } from "@/features/shell/app-shell";
import { useWallet } from "@/features/wallet/wallet-store";

export default function WalletsPage() {
  const state = useWallet();
  return (
    <AppShell>
      {state.phase === "ready" || state.phase === "syncing" ? (
        <PrivateWallets />
      ) : state.phase === "empty" ? (
        <p className="opacity-70">
          Create your private balance first.{" "}
          <Link href="/wallet" className="underline">
            Go to Balance
          </Link>
        </p>
      ) : state.phase === "error" ? (
        <p className="text-red-400">{state.error}</p>
      ) : (
        <p className="opacity-70">Loading the private wallet engine…</p>
      )}
    </AppShell>
  );
}
