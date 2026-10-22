"use client";

import { PrivacyView } from "@/features/privacy/privacy-view";
import { AppShell } from "@/features/shell/app-shell";

export default function PrivacyPage() {
  return (
    <AppShell>
      <PrivacyView />
    </AppShell>
  );
}
