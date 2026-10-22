"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { ZEC_NETWORK } from "@/constants";
import { startJobs } from "../private-wallets/jobs";
import { loadRegistry } from "../private-wallets/registry-store";
import { bootWallet } from "../wallet/wallet-store";

const LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/wallet", label: "Balance" },
  { href: "/wallets", label: "Private wallets" },
] as const;

/** One query cache for the whole app (markets, accounts), kept across screens. */
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

/** The app frame: navigation, the network badge, and the engine boot shared by every screen. */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const path = usePathname();
  useEffect(() => {
    void bootWallet();
    void loadRegistry().then(startJobs);
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <main className={`mx-auto flex min-h-dvh flex-col gap-6 px-4 py-8 sm:px-6 ${wide ? "max-w-6xl" : "max-w-xl"}`}>
        <header className="flex items-center justify-between gap-4">
          <nav className="flex gap-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={path.startsWith(l.href) ? "font-semibold" : "opacity-60 hover:opacity-100"}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <span className="text-xs opacity-60">{ZEC_NETWORK === "main" ? "Zcash mainnet" : "Zcash testnet"}</span>
        </header>
        {children}
      </main>
    </QueryClientProvider>
  );
}
