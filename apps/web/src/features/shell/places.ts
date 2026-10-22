import { CandlestickChart, Coins, LayoutGrid, type LucideIcon, ShieldCheck, Target, WalletCards } from "lucide-react";

export interface Place {
  id: string;
  name: string;
  href: string;
  /** The key that jumps here (1–6). */
  key: string;
  icon: LucideIcon;
  /** One line for tooltips and the palette. */
  description: string;
  /** Paths that count as "here" (prefix match). */
  paths: readonly string[];
}

/** The rail's places, in order. Every page lives under one of them. */
export const PLACES: readonly Place[] = [
  {
    id: "markets",
    name: "Markets",
    href: "/markets",
    key: "1",
    icon: LayoutGrid,
    description: "Everything you can trade privately, on every venue.",
    paths: ["/markets"],
  },
  {
    id: "perps",
    name: "Perps",
    href: "/trade",
    key: "2",
    icon: CandlestickChart,
    description: "Hyperliquid perpetuals on a live terminal.",
    paths: ["/trade"],
  },
  {
    id: "predict",
    name: "Predict",
    href: "/predict",
    key: "3",
    icon: Target,
    description: "Polymarket events: buy Yes or No.",
    paths: ["/predict", "/event"],
  },
  {
    id: "tokens",
    name: "Tokens",
    href: "/tokens",
    key: "4",
    icon: Coins,
    description: "Solana tokens through Jupiter.",
    paths: ["/tokens", "/token"],
  },
  {
    id: "wallets",
    name: "Wallets",
    href: "/wallets",
    key: "5",
    icon: WalletCards,
    description: "Your private wallets: one per trade, never linked.",
    paths: ["/wallets"],
  },
  {
    id: "balance",
    name: "Balance",
    href: "/wallet",
    key: "6",
    icon: ShieldCheck,
    description: "Your shielded ZEC: deposit, withdraw, history.",
    paths: ["/wallet"],
  },
];

export function placeFor(path: string): Place | undefined {
  return PLACES.find((p) => p.paths.some((x) => path === x || path.startsWith(`${x}/`)));
}
