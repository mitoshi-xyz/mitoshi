"use client";

import { AppShell } from "@/features/shell/app-shell";
import { Lost } from "@/features/states/lost";

export default function NotFound() {
  return (
    <AppShell>
      <Lost code="404" line="Nothing here. Not even a wallet trail." />
    </AppShell>
  );
}
