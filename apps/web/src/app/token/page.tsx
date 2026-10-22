"use client";

import { AppShell } from "@/features/shell/app-shell";
import { TokenView } from "@/features/solana/token-view";

export default function TokenPage() {
  return (
    <AppShell>
      <TokenView />
    </AppShell>
  );
}
