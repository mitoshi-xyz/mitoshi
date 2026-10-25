"use client";

import { AppWindow } from "lucide-react";
import { Button } from "@/kit";
import { claimTab } from "../vault/tab-lock";

/** This tab doesn't hold the wallet: another one does. One tap moves it here. */
export function OtherTab() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <AppWindow size={24} />
      </span>
      <h1 className="type-headline-md">Mitoshi is open in another tab</h1>
      <p className="text-[14px] text-ink-2">One tab holds your wallet at a time, so nothing runs twice.</p>
      <Button tone="primary" size="lg" onClick={() => void claimTab(true).then(() => window.location.reload())}>
        Use it here
      </Button>
    </section>
  );
}
