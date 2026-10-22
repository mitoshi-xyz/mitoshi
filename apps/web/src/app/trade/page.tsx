"use client";

import { AppShell } from "@/features/shell/app-shell";
import { Terminal } from "@/features/trade/terminal";

export default function TradePage() {
  return (
    <AppShell bleed>
      <Terminal />
    </AppShell>
  );
}
