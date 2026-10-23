"use client";

import { useEffect } from "react";
import { AppShell } from "@/features/shell/app-shell";
import { Lost, recoverFromChunkError } from "@/features/states/lost";

/** A page that threw: a chunk from an older deploy reloads once on its own; anything else says so, with a retry. */
export default function PageError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    recoverFromChunkError(error);
  }, [error]);
  return (
    <AppShell>
      <Lost code="Oops" line="This page broke. Your money is where it was." retry={reset} />
    </AppShell>
  );
}
