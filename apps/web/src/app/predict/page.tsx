"use client";

import { EventGrid } from "@/features/polymarket/event-grid";
import { AppShell } from "@/features/shell/app-shell";

export default function PredictPage() {
  return (
    <AppShell>
      <EventGrid />
    </AppShell>
  );
}
