"use client";

import { MarketsView } from "@/features/markets/markets-view";
import { AppShell } from "@/features/shell/app-shell";

export default function MarketsPage() {
  return (
    <AppShell>
      <MarketsView />
    </AppShell>
  );
}
