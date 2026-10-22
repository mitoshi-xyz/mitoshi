"use client";

import { SettingsView } from "@/features/settings/settings";
import { AppShell } from "@/features/shell/app-shell";

export default function SettingsPage() {
  return (
    <AppShell>
      <SettingsView />
    </AppShell>
  );
}
