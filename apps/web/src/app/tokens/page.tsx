"use client";

import { AppShell } from "@/features/shell/app-shell";
import { TokensTable } from "@/features/solana/tokens-table";

export default function TokensPage() {
  return (
    <AppShell>
      <TokensTable />
    </AppShell>
  );
}
