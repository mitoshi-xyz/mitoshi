"use client";

import { PerpsTable } from "@/features/markets/perps-table";
import { AppShell } from "@/features/shell/app-shell";

export default function MarketsPage() {
  return (
    <AppShell wide>
      <PerpsTable />
    </AppShell>
  );
}
