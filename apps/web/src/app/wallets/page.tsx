"use client";

import { AlertTriangle, KeyRound } from "lucide-react";
import { PrivateWallets } from "@/features/private-wallets/private-wallets";
import { AppShell } from "@/features/shell/app-shell";
import { useWallet } from "@/features/wallet/wallet-store";
import { EmptyState, Skeleton } from "@/kit";

export default function WalletsPage() {
  const state = useWallet();
  return (
    <AppShell>
      {state.phase === "ready" || state.phase === "syncing" ? (
        <PrivateWallets />
      ) : state.phase === "empty" || state.phase === "creating" ? (
        <EmptyState
          icon={KeyRound}
          title="Make your private balance first"
          body="Private wallets are funded from shielded ZEC that lives in this browser."
          action={{ label: "Set it up", href: "/wallet" }}
        />
      ) : state.phase === "error" ? (
        <EmptyState
          icon={AlertTriangle}
          title="The wallet engine stopped"
          body={`${state.error ?? "Unknown error"}. Your ZEC and wallets are safe.`}
          action={{ label: "Reload", onClick: () => window.location.reload() }}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-64" label="Opening the wallet engine" />
          <div className="grid gap-2 md:grid-cols-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-xl" />
            <Skeleton className="h-56 rounded-xl" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
