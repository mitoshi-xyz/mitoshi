"use client";

import type { Venue } from "@mitoshi/engine";
import type { SolToken } from "@mitoshi/venues/solana";
import { ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { useQueries } from "@tanstack/react-query";
import { ZEC_NETWORK } from "@/constants";
import { useZecUsd } from "../hyperliquid/hooks";
import { usePerpMarkets } from "../perps/hooks";
import { useRegistry } from "../private-wallets/registry-store";
import { solMarket } from "../solana/sol";
import { money, type WalletState } from "../wallet/wallet-store";
import { type PositionRow, useBooks, type WalletBook, withCostBasis } from "./book";

const TOKEN_STALE_MS = 300_000;
const MINT_HEAD = 4;

/** One line of "Your assets": a token, where it is, how much of it, and what it is worth now. */
export interface Asset {
  key: string;
  symbol: string;
  /** Where it sits: "Shielded", or the venue's name. */
  where: string;
  venue: Venue | null;
  /** In its own unit (ZEC, USDC, pUSD, SOL, the token). */
  amount: number;
  unit: string;
  /** Null when there is no price for it (testnet ZEC). */
  valueUsd: number | null;
  src?: string | null;
  href?: string;
  pnlUsd?: number | null;
  wallets: number;
}

const CASH: Record<Venue, { symbol: string; where: string; href: string }> = {
  hyperliquid: { symbol: "USDC", where: "Hyperliquid", href: "/trade" },
  polymarket: { symbol: "pUSD", where: "Polymarket", href: "/predict" },
  solana: { symbol: "SOL", where: "Solana", href: "/tokens" },
};

/** A wallet's money in positions (perps and outcome shares): what is neither its cash nor its Solana tokens. */
const inPositions = (b: WalletBook) => (b.w.venue === "solana" ? 0 : b.valueUsd - b.cashUsd);
const inTokens = (b: WalletBook) => (b.w.venue === "solana" ? b.valueUsd - b.cashUsd : 0);

export interface PortfolioView {
  /** Everything: the shielded ZEC at the live price plus every private wallet's cash, tokens and positions. */
  totalUsd: number | null;
  zec: { total: number; spendable: number; resting: number; confirming: number; orchard: number };
  zecUsd: number | null;
  shieldedUsd: number | null;
  cashUsd: number;
  tokensUsd: number;
  positionsUsd: number;
  /** Today's change: the venues' own day P&L plus the shielded ZEC's move since yesterday's price. */
  dayUsd: number | null;
  openPnlUsd: number | null;
  allTimeUsd: number | null;
  swapCostUsd: number;
  assets: Asset[];
  positions: PositionRow[];
  books: WalletBook[];
  tokens: Record<string, SolToken | null | undefined>;
  loading: boolean;
}

/** A wallet's whole result: what it holds now plus what came home, less what funded it. */
export const allTime = (b: WalletBook) => (b.fundedUsd === null ? null : b.valueUsd + b.homeUsd - b.fundedUsd);

/**
 * The portfolio in one place, put together only in this browser: the total, what it is made of token by token, and
 * the open positions. Every surface that shows the balance reads it from here, so no two figures disagree.
 */
export function usePortfolio(state: WalletState): PortfolioView {
  const registry = useRegistry();
  const zecLive = useZecUsd();
  const markets = usePerpMarkets("hyperliquid");
  const books = useBooks(registry.wallets);
  const mints = [...new Set(books.flatMap((b) => b.positions.filter((p) => p.kind === "token").map((p) => p.asset)))];
  const meta = useQueries({
    queries: mints.map((m) => ({
      queryKey: ["solana", "token", m],
      queryFn: () => solMarket.token(m),
      staleTime: TOKEN_STALE_MS,
    })),
  });
  const tokens = Object.fromEntries(mints.map((m, i) => [m, meta[i]?.data]));
  const rows = withCostBasis(
    books.flatMap((b) => b.positions),
    (m) => tokens[m]?.decimals,
  );

  const m = money(state.summary?.balance);
  const zec = {
    total: (m.spendable + m.resting + m.confirming + m.orchard) / ZAT_PER_ZEC,
    spendable: m.spendable / ZAT_PER_ZEC,
    resting: m.resting / ZAT_PER_ZEC,
    confirming: m.confirming / ZAT_PER_ZEC,
    orchard: m.orchard / ZAT_PER_ZEC,
  };
  const zecUsd = ZEC_NETWORK === "main" ? zecLive : null;
  const zecYesterday = markets.data?.find((x) => x.id === "ZEC")?.prevDayPx ?? null;
  const shieldedUsd = zecUsd === null ? null : zec.total * zecUsd;
  const cashUsd = books.reduce((n, b) => n + b.cashUsd, 0);
  const tokensUsd = books.reduce((n, b) => n + inTokens(b), 0);
  const positionsUsd = books.reduce((n, b) => n + inPositions(b), 0);

  // Each venue's cash is one line however many wallets hold it; Solana tokens are one line per token.
  const assets: Asset[] = [
    {
      key: "zec",
      symbol: "ZEC",
      where: "Shielded",
      venue: null,
      amount: zec.total,
      unit: ZEC_NETWORK === "main" ? "ZEC" : "TAZ",
      valueUsd: shieldedUsd,
      wallets: 1,
    },
  ];
  for (const venue of Object.keys(CASH) as Venue[]) {
    const held = books.filter((b) => b.w.venue === venue && (b.cashAmount > 0 || b.cashUsd > 0));
    if (held.length === 0) continue;
    const c = CASH[venue];
    assets.push({
      key: `cash:${venue}`,
      symbol: c.symbol,
      where: c.where,
      venue,
      amount: held.reduce((n, b) => n + b.cashAmount, 0),
      unit: c.symbol,
      valueUsd: held.reduce((n, b) => n + b.cashUsd, 0),
      href: c.href,
      wallets: held.length,
    });
  }
  const byMint = new Map<string, PositionRow[]>();
  for (const r of rows) if (r.kind === "token") byMint.set(r.asset, [...(byMint.get(r.asset) ?? []), r]);
  for (const [mint, held] of byMint) {
    const t = tokens[mint];
    const symbol = t?.symbol ?? `${mint.slice(0, MINT_HEAD)}…`;
    const pnls = held.map((r) => r.pnlUsd).filter((v): v is number => v !== null);
    assets.push({
      key: `token:${mint}`,
      symbol,
      where: "Solana",
      venue: "solana",
      amount: held.reduce((n, r) => n + r.size, 0),
      unit: symbol,
      valueUsd: held.reduce((n, r) => n + r.valueUsd, 0),
      src: t?.icon ?? null,
      href: `/token#${mint}`,
      pnlUsd: pnls.length ? pnls.reduce((n, v) => n + v, 0) : null,
      wallets: new Set(held.map((r) => r.w.id)).size,
    });
  }
  assets.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  const positions = rows.filter((r) => r.kind !== "token");
  const pnls = rows.map((r) => r.pnlUsd).filter((v): v is number => v !== null);
  const venueDay = books.map((b) => b.dayPnlUsd).filter((v): v is number => v !== null);
  const zecDay = zecUsd !== null && zecYesterday ? zec.total * (zecUsd - zecYesterday) : null;
  const dayParts = [...venueDay, ...(zecDay === null ? [] : [zecDay])];
  const known = books.map(allTime).filter((v): v is number => v !== null);

  return {
    totalUsd: shieldedUsd === null ? null : shieldedUsd + cashUsd + tokensUsd + positionsUsd,
    zec,
    zecUsd,
    shieldedUsd,
    cashUsd,
    tokensUsd,
    positionsUsd,
    dayUsd: dayParts.length ? dayParts.reduce((n, v) => n + v, 0) : null,
    openPnlUsd: pnls.length ? pnls.reduce((n, v) => n + v, 0) : null,
    allTimeUsd: known.length ? known.reduce((n, v) => n + v, 0) : null,
    swapCostUsd: books.reduce((n, b) => n + b.swapCostUsd, 0),
    assets,
    positions,
    books,
    tokens,
    loading: books.some((b) => b.loading),
  };
}
