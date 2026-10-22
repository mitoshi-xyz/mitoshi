"use client";

import { AlertTriangle } from "lucide-react";
import { AppShell } from "@/features/shell/app-shell";
import { BalanceView } from "@/features/wallet/balance-view";
import { Onboarding } from "@/features/wallet/onboarding";
import { useWallet } from "@/features/wallet/wallet-store";
import { EmptyState, Skeleton } from "@/kit";

export default function WalletPage() {
  const state = useWallet();
  return (
    <AppShell>
      {state.phase === "idle" || state.phase === "loading" ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-48" label="Opening the wallet engine" />
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : state.phase === "empty" || state.phase === "creating" ? (
        <Onboarding />
      ) : state.phase === "error" ? (
        <EmptyState
          icon={AlertTriangle}
          title="The wallet engine stopped"
          body={`${state.error ?? "Unknown error"}. Your ZEC is safe on the chain.`}
          action={{ label: "Reload", onClick: () => window.location.reload() }}
        />
      ) : (
        <BalanceView state={state} />
      )}
    </AppShell>
  );
}
