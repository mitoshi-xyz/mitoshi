"use client";

import "./globals.css";
import { useEffect } from "react";
import { Lost, recoverFromChunkError } from "@/features/states/lost";
import { fontVariables } from "@/lib/fonts";

/** The whole app failed to start: the same page as a broken screen, without the shell (which may be what broke). */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    recoverFromChunkError(error);
  }, [error]);
  return (
    <html lang="en" data-theme="dark" className={fontVariables}>
      <body className="bg-bg px-4 text-ink">
        <Lost code="Oops" line="Mitoshi could not start. Your money is where it was." retry={reset} />
      </body>
    </html>
  );
}
