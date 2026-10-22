"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { WalletDrawers } from "../private-wallets/drawers";
import { startJobs } from "../private-wallets/jobs";
import { loadRegistry } from "../private-wallets/registry-store";
import { bootWallet } from "../wallet/wallet-store";
import { Dock } from "./dock";
import { More } from "./more";
import { Palette } from "./palette";
import { PLACES } from "./places";
import { Rail } from "./rail";
import { TopLine } from "./top-line";

/** One query cache for the whole app (markets, accounts), kept across screens. */
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable === true;
};

/**
 * The app frame: the floating rail, the top line, one framed stage, the phone dock, More and ⌘K. It also boots
 * the wallet engine and the private-wallet jobs once, and keeps keys 1–6 and ⌘K / "/" working everywhere.
 */
export function AppShell({ children, bleed = false }: { children: ReactNode; bleed?: boolean; wide?: boolean }) {
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.network = ZEC_NETWORK;
    void bootWallet();
    void loadRegistry().then(startJobs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
        return;
      }
      const place = PLACES.find((p) => p.key === e.key);
      if (place) router.push(place.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="mt-shell">
        <a
          href="#main"
          className="fixed top-2 left-2 z-[var(--z-skip)] -translate-y-[200%] rounded-full bg-accent px-4 py-2 font-bold text-accent-ink text-sm focus-visible:translate-y-0"
        >
          Skip to content
        </a>
        <Rail />
        <div className="mt-column">
          <TopLine onSearch={() => setPalette(true)} />
          <main id="main" tabIndex={-1} className="mt-stage" data-bleed={bleed ? "" : undefined}>
            {children}
          </main>
        </div>
        <Dock onMore={() => setMore(true)} />
        <More open={more} onClose={() => setMore(false)} />
        <Palette open={palette} onClose={() => setPalette(false)} />
        <WalletDrawers />
      </div>
    </QueryClientProvider>
  );
}
