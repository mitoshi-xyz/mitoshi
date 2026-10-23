"use client";

import { Status } from "@/features/settings/status";
import { AppShell } from "@/features/shell/app-shell";

export default function StatusPage() {
  return (
    <AppShell>
      <section className="flex flex-col gap-6">
        <h1 className="type-headline-lg">Status</h1>
        <Status />
      </section>
    </AppShell>
  );
}
