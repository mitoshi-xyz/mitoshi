import type { Venue, WalletStatus } from "@mitoshi/engine";

export interface VenueInfo {
  id: Venue;
  name: string;
  /** What a new wallet holds when it arrives. */
  gets: string;
  /** Where its trading happens in the app. */
  trade: { href: string; label: string };
  /** Public pages about an address: what a copy trader would open. */
  explorers: (address: string) => { label: string; href: string }[];
  /** Whether wallets can be funded and brought home for this venue yet. */
  live: boolean;
}

export const VENUES: Record<Venue, VenueInfo> = {
  hyperliquid: {
    id: "hyperliquid",
    name: "Hyperliquid",
    gets: "USDC on Hyperliquid",
    trade: { href: "/trade", label: "Trade perps" },
    explorers: (a) => [
      { label: "Hyperliquid explorer", href: `https://app.hyperliquid.xyz/explorer/address/${a}` },
      { label: "Hypurrscan", href: `https://hypurrscan.io/address/${a}` },
    ],
    live: true,
  },
  solana: {
    id: "solana",
    name: "Solana",
    gets: "SOL",
    trade: { href: "/tokens", label: "Trade tokens" },
    explorers: (a) => [
      { label: "Solscan", href: `https://solscan.io/account/${a}` },
      { label: "Solana Explorer", href: `https://explorer.solana.com/address/${a}` },
    ],
    live: true,
  },
  polymarket: {
    id: "polymarket",
    name: "Polymarket",
    gets: "USDC on Polygon",
    trade: { href: "/predict", label: "Trade predictions" },
    explorers: (a) => [
      { label: "Polymarket profile", href: `https://polymarket.com/profile/${a}` },
      { label: "Polygonscan", href: `https://polygonscan.com/address/${a}` },
    ],
    // Funding lands on a Deposit Wallet through the Polymarket bridge, which comes with trading (S4).
    live: false,
  },
};

export const VENUE_ORDER: Venue[] = ["hyperliquid", "solana", "polymarket"];

export type Tone = "muted" | "accent" | "up" | "warning" | "down";

export const STATUS: Record<WalletStatus, { word: string; tone: Tone; live: boolean }> = {
  preparing: { word: "Preparing", tone: "muted", live: true },
  funding: { word: "Funding", tone: "accent", live: true },
  ready: { word: "Ready", tone: "up", live: false },
  trading: { word: "Trading", tone: "up", live: true },
  returning: { word: "Coming home", tone: "accent", live: true },
  retired: { word: "Retired", tone: "muted", live: false },
  refunded: { word: "Refunded", tone: "warning", live: false },
  failed: { word: "Needs you", tone: "down", live: false },
};

const ADDRESS_HEAD = 6;
const ADDRESS_TAIL = 4;
export const shortAddress = (a: string) => `${a.slice(0, ADDRESS_HEAD)}…${a.slice(-ADDRESS_TAIL)}`;
