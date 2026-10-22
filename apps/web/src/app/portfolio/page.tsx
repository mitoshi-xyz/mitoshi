"use client";

import { AlertTriangle, KeyRound } from "lucide-react";
import { Portfolio } from "@/features/portfolio/portfolio";
import { AppShell } from "@/features/shell/app-shell";
import { useWallet } from "@/features/wallet/wallet-store";
import { EmptyState, Skeleton } from "@/kit";

export default function PortfolioPage() {
  const state = useWallet();
  return (
    <AppShell>
      {state.phase === "ready" || state.phase === "syncing" ? (
        <Portfolio />
      ) : state.phase === "empty" || state.phase === "creating" ? (
        <EmptyState
          icon={KeyRound}
          title="Make your private balance first"
          body="The portfolio is put together from your private wallets, which live in this browser."
          action={{ label: "Set it up", href: "/wallet" }}
        />
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
