"use client";

import { EventView } from "@/features/polymarket/event-view";
import { AppShell } from "@/features/shell/app-shell";

export default function EventPage() {
  return (
    <AppShell wide>
      <EventView />
    </AppShell>
  );
}
