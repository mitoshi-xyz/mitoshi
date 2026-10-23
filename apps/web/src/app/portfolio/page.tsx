"use client";

import { AlertTriangle } from "lucide-react";
import { Portfolio } from "@/features/portfolio/portfolio";
import { AppShell } from "@/features/shell/app-shell";
import { Onboarding } from "@/features/wallet/onboarding";
import { useWallet } from "@/features/wallet/wallet-store";
import { EmptyState, Skeleton } from "@/kit";

export default function PortfolioPage() {
  const state = useWallet();
  return (
    <AppShell>
      {state.phase === "ready" || state.phase === "syncing" ? (
        <Portfolio state={state} />
      ) : state.phase === "empty" || state.phase === "creating" ? (
        <Onboarding />
      ) : state.phase === "error" ? (
        <EmptyState
          icon={AlertTriangle}
          title="The wallet engine stopped"
          body={`${state.error ?? "Unknown error"}. Your money is safe.`}
          action={{ label: "Reload", onClick: () => window.location.reload() }}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-48" label="Opening the wallet engine" />
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}
    </AppShell>
  );
}
