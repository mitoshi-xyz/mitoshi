import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  ChartPie,
  Coins,
  EyeOff,
  LayoutGrid,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Target,
  WalletCards,
} from "lucide-react";

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
    id: "portfolio",
    name: "Portfolio",
    href: "/portfolio",
    key: "5",
    icon: ChartPie,
    description: "Every position on every venue, in one private view.",
    paths: ["/portfolio"],
  },
  {
    id: "wallets",
    name: "Wallets",
    href: "/wallets",
    key: "6",
    icon: WalletCards,
    description: "Your private wallets: one per trade, never linked.",
    paths: ["/wallets"],
  },
];

export interface Page {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  group: "money" | "mitoshi";
}

/** Pages off the rail: in More, and in ⌘K. */
export const PAGES: readonly Page[] = [
  {
    name: "Balance",
    href: "/wallet",
    icon: ShieldCheck,
    description: "Your shielded ZEC and its history.",
    group: "money",
  },
  {
    name: "Deposit",
    href: "/wallet#deposit",
    icon: ArrowDownToLine,
    description: "A fresh shielded address.",
    group: "money",
  },
  {
    name: "Withdraw",
    href: "/wallet#withdraw",
    icon: ArrowUpFromLine,
    description: "Send ZEC out, with the leak meter.",
    group: "money",
  },
  {
    name: "Privacy",
    href: "/privacy",
    icon: EyeOff,
    description: "Who sees what, and what the public sees.",
    group: "mitoshi",
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Backup, lock, keep ready, sounds, Forget.",
    group: "mitoshi",
  },
  {
    name: "Status",
    href: "/settings#status",
    icon: Activity,
    description: "Every party on the private path, live.",
    group: "mitoshi",
  },
];

export function placeFor(path: string): Place | undefined {
  return PLACES.find((p) => p.paths.some((x) => path === x || path.startsWith(`${x}/`)));
}
