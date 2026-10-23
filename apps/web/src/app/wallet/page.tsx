"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/features/shell/app-shell";
import { Onboarding } from "@/features/wallet/onboarding";
import { useWallet } from "@/features/wallet/wallet-store";
import { EmptyState, Skeleton } from "@/kit";

/** Making or restoring the private balance. Once it exists, the money lives on Portfolio. */
export default function WalletPage() {
  const state = useWallet();
  const router = useRouter();
  const ready = state.phase === "ready" || state.phase === "syncing";
  useEffect(() => {
    if (ready) router.replace(`/portfolio${window.location.hash}`);
  }, [ready, router]);
  return (
    <AppShell>
      {state.phase === "empty" || state.phase === "creating" ? (
        <Onboarding />
      ) : state.phase === "error" ? (
        <EmptyState
          icon={AlertTriangle}
          title="The wallet engine stopped"
          body={`${state.error ?? "Unknown error"}. Your ZEC is safe on the chain.`}
          action={{ label: "Reload", onClick: () => window.location.reload() }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-48" label="Opening the wallet engine" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}
    </AppShell>
  );
}
