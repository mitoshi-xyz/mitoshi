"use client";

import { latestSwap, type PrivateWallet, type SwapRecord } from "@mitoshi/engine";
import type { QuoteResponse } from "@mitoshi/rails";
import type { PmPosition } from "@mitoshi/venues/polymarket";
import { SOL_MINT } from "@mitoshi/venues/solana";
import { useQueries } from "@tanstack/react-query";
import { hlAccount, hlMarket } from "../hyperliquid/hl";
import { useLiveMids } from "../hyperliquid/hooks";
import type { PerpAccount, PerpVenue } from "../perps/model";
import { pmDriver } from "../perps/pm-driver";
import { pmMarket } from "../polymarket/pm";
import { solAccount, solMarket } from "../solana/sol";

/**
 * Wallets read from their venue: the ones that have traded. A ready wallet has done nothing since its funding, so its
 * money is what the funding delivered ({@link arrived}); reading it beside the others on every visit would show the venue
 * that it belongs with them before it has made a single trade.
 */
const READ = new Set<PrivateWallet["status"]>(["trading", "returning", "failed"]);
const LAMPORTS_PER_SOL = 1_000_000_000;
/**
 * Each wallet is read on its own random schedule (20–60 s) after its own random first delay (up to 20 s when there is
 * more than one): a gateway or venue that saw several addresses asked about in one burst, over and over, could guess
 * they belong together. Spread out, their reads blend with everyone else's; the residual is in the threat model.
 */
const POLL_MIN_MS = 20_000;
const POLL_SPREAD_MS = 40_000;
const FIRST_DELAY_MAX_MS = 20_000;

const jitter = (spread: number) => Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] ?? 0) % spread;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PositionRow {
  key: string;
  w: PrivateWallet;
  kind: "perp" | "token" | "outcome";
  /** Polymarket: the outcome and market, in words. */
  label?: string;
  /** Polymarket: resolved in this outcome's favour, waiting to be redeemed. */
  redeemable?: boolean;
  /** Polymarket: the event it belongs to. */
  eventId?: string | null;
  /** Hyperliquid coin, Polymarket Perps symbol, or Solana mint. */
  asset: string;
  /** Perps: which venue the position is on (the terminal link). */
  perpVenue?: PerpVenue;
  side: "long" | "short" | null;
  leverage: number | null;
  /** Coins (perps) or tokens. */
  size: number;
  valueUsd: number;
  entryPx: number | null;
  markPx: number | null;
  pnlUsd: number | null;
  liquidationPx: number | null;
}

export interface WalletBook {
  w: PrivateWallet;
  loading: boolean;
  error: string | null;
  /** Everything on the venue now, in USD (0 once it has come home). */
  valueUsd: number;
  /** Cash not in a position: USDC on Hyperliquid, SOL on Solana. */
  cashUsd: number;
  /** The same cash in its own unit: USDC, pUSD or SOL. */
  cashAmount: number;
  /** What arrived when it was funded, in USD (NEAR's own figure). */
  fundedUsd: number | null;
  /** What came home, in USD. */
  homeUsd: number;
  /** What the NEAR swaps cost, in and out. */
  swapCostUsd: number;
  dayPnlUsd: number | null;
  positions: PositionRow[];
}

const quoteOf = (s: SwapRecord) => (s.signedQuote as QuoteResponse | undefined)?.quote;
const settled = (s: SwapRecord) => s.status === "SUCCESS";

/** What a ready wallet holds: exactly what its funding delivered (on Solana, that SOL at today's price). */
function arrived(w: PrivateWallet, mids: Record<string, number>): { usd: number; amount: number } {
  const fund = latestSwap(w, "fund");
  const q = fund && settled(fund) ? quoteOf(fund) : undefined;
  if (!q) return { usd: 0, amount: 0 };
  if (w.venue === "solana") {
    const sol = Number(q.amountOut) / LAMPORTS_PER_SOL;
    return { usd: mids.SOL ? sol * mids.SOL : 0, amount: sol };
  }
  return { usd: Number(q.amountOutUsd), amount: Number(q.amountOutUsd) };
}

function swapsBook(w: PrivateWallet) {
  const fund = latestSwap(w, "fund");
  const fq = fund && settled(fund) ? quoteOf(fund) : undefined;
  const homes = w.swaps.filter((s) => s.kind === "return" && settled(s));
  const cost = w.swaps
    .filter(settled)
    .map(quoteOf)
    .reduce((n, q) => n + (q ? Number(q.amountInUsd) - Number(q.amountOutUsd) : 0), 0);
  return {
    fundedUsd: fq ? Number(fq.amountOutUsd) : null,
    homeUsd: homes.map(quoteOf).reduce((n, q) => n + (q ? Number(q.amountOutUsd) : 0), 0),
    swapCostUsd: cost,
  };
}

type VenueRead =
  | { venue: "polymarket"; positions: PmPosition[]; cash: number; perps: PerpAccount | null }
  | { venue: "hyperliquid"; state: Awaited<ReturnType<Awaited<ReturnType<typeof hlAccount>>["state"]>>; day: number }
  | { venue: "solana"; lamports: bigint; tokens: { mint: string; uiAmount: number }[]; prices: Record<string, number> };

async function readVenue(w: PrivateWallet): Promise<VenueRead> {
  if (w.venue === "polymarket") {
    // Public data only: opening the account would deploy the wallet just to read it.
    // A wallet that opened Polymarket Perps also has a Perps account (read only once it exists).
    // Cash is pUSD plus any USDC a refunded trip home brought back.
    const [positions, pusd, usdc, perps] = await Promise.all([
      pmMarket.positions(w.address),
      pmMarket.pusd(w.address),
      pmMarket.usdc(w.address),
      w.perps ? pmDriver.account(w) : Promise.resolve(null),
    ]);
    return { venue: "polymarket", positions, cash: pusd + usdc, perps };
  }
  if (w.venue === "hyperliquid") {
    const account = await hlAccount(w);
    const [state, day] = await Promise.all([account.state(), hlMarket.dayPnl(account.address)]);
    return { venue: "hyperliquid", state, day };
  }
  const account = await solAccount(w);
  const h = await account.holdings();
  const prices = await solMarket.prices([SOL_MINT, ...h.tokens.map((t) => t.mint)]);
  return { venue: "solana", lamports: h.lamports, tokens: h.tokens, prices };
}

/** Average cost of what is still held, from the wallet's own recorded buys (USD at the time). */
function costOfHeld(w: PrivateWallet, mint: string, held: number, decimals: number): number | null {
  const buys = (w.trades ?? []).filter((t) => t.asset === mint && t.side === "buy" && t.usd !== null);
  const bought = buys.reduce((n, t) => n + Number(t.outAmount) / 10 ** decimals, 0);
  if (bought <= 0) return null;
  const spent = buys.reduce((n, t) => n + (t.usd ?? 0), 0);
  return (spent / bought) * held;
}

/**
 * The portfolio's numbers, wallet by wallet: what each holds now (read from its venue over
 * OHTTP, each on its own schedule), what funded it, what came home, and what the swaps cost.
 * Solana tokens get their cost basis from {@link withCostBasis} once their decimals are known.
 */
export function useBooks(wallets: PrivateWallet[]): WalletBook[] {
  const mids = useLiveMids();
  const results = useQueries({
    queries: wallets.map((w) => ({
      queryKey: ["portfolio", w.id],
      enabled: READ.has(w.status),
      refetchInterval: () => POLL_MIN_MS + jitter(POLL_SPREAD_MS),
      queryFn: async () => {
        // One wallet links to nothing: read it at once. Several: each waits its own random moment.
        if (wallets.filter((x) => READ.has(x.status)).length > 1) await sleep(jitter(FIRST_DELAY_MAX_MS));
        return readVenue(w);
      },
    })),
  });

  return wallets.map((w, i) => {
    const r = results[i];
    const base = swapsBook(w);
    const book: WalletBook = {
      w,
      loading: READ.has(w.status) && Boolean(r?.isPending),
      error: r?.error ? r.error.message : null,
      valueUsd: 0,
      cashUsd: 0,
      cashAmount: 0,
      dayPnlUsd: null,
      positions: [],
      ...base,
    };
    if (w.status === "ready") {
      const a = arrived(w, mids);
      book.cashUsd = a.usd;
      book.cashAmount = a.amount;
      book.valueUsd = a.usd;
      return book;
    }
    const d = r?.data;
    if (!d) return book;
    if (d.venue === "polymarket") {
      book.cashUsd = d.cash;
      book.cashAmount = d.cash;
      book.positions = d.positions
        .filter((p) => p.size > 0)
        .map((p) => ({
          key: `${w.id}:${p.assetId}`,
          w,
          kind: "outcome",
          asset: p.assetId,
          label: `${p.outcome ?? "Outcome"} · ${p.title ?? ""}`,
          side: null,
          leverage: null,
          size: p.size,
          valueUsd: p.valueUsd,
          entryPx: p.size > 0 ? p.costUsd / p.size : null,
          markPx: p.price,
          pnlUsd: p.valueUsd - p.costUsd,
          liquidationPx: null,
          redeemable: p.redeemable,
          eventId: p.eventId,
        }));
      // The Perps account's equity (its figure counts the Deposit Wallet's cash too, which is already in cashUsd).
      const perpsEquity = d.perps ? d.perps.equity - d.cash : 0;
      for (const p of d.perps?.positions ?? []) {
        book.positions.push({
          key: `${w.id}:perps:${p.marketId}`,
          w,
          kind: "perp",
          perpVenue: "pmperps",
          asset: p.marketId,
          label: p.marketId.replace(/-USD$/, ""),
          side: p.size > 0 ? "long" : "short",
          leverage: p.leverage,
          size: Math.abs(p.size),
          valueUsd: p.valueUsd,
          entryPx: p.entryPx,
          markPx: p.size ? p.entryPx + p.unrealizedPnl / p.size : null,
          pnlUsd: p.unrealizedPnl,
          liquidationPx: p.liquidationPx,
        });
      }
      book.valueUsd =
        book.cashUsd +
        perpsEquity +
        book.positions.filter((p) => p.kind === "outcome").reduce((n, p) => n + p.valueUsd, 0);
      return book;
    }
    if (d.venue === "hyperliquid") {
      const s = d.state;
      book.positions = s.positions.map((p) => {
        const mark = mids[p.coin] ?? null;
        return {
          key: `${w.id}:${p.coin}`,
          w,
          kind: "perp",
          perpVenue: "hyperliquid",
          asset: p.coin,
          side: p.size > 0 ? "long" : "short",
          leverage: p.leverage,
          size: Math.abs(p.size),
          valueUsd: mark ? Math.abs(p.size) * mark : p.valueUsd,
          entryPx: p.entryPx,
          markPx: mark,
          // Live: the venue's figure moved to the latest mid.
          pnlUsd: mark ? p.size * (mark - p.entryPx) : p.unrealizedPnl,
          liquidationPx: p.liquidationPx,
        };
      });
      const open = book.positions.reduce((n, p) => n + (p.pnlUsd ?? 0), 0);
      const venuePnl = s.positions.reduce((n, p) => n + p.unrealizedPnl, 0);
      book.cashUsd = s.spotUsdc + s.withdrawable;
      book.cashAmount = book.cashUsd;
      book.valueUsd = s.spotUsdc + s.perpValue + (open - venuePnl);
      book.dayPnlUsd = d.day;
      return book;
    }
    const solUsd = d.prices[SOL_MINT] ?? 0;
    book.cashAmount = Number(d.lamports) / LAMPORTS_PER_SOL;
    book.cashUsd = book.cashAmount * solUsd;
    book.positions = d.tokens.map((t) => {
      const px = d.prices[t.mint] ?? null;
      const value = px ? t.uiAmount * px : 0;
      return {
        key: `${w.id}:${t.mint}`,
        w,
        kind: "token",
        asset: t.mint,
        side: null,
        leverage: null,
        size: t.uiAmount,
        valueUsd: value,
        entryPx: null,
        markPx: px,
        pnlUsd: null,
        liquidationPx: null,
      };
    });
    book.valueUsd = book.cashUsd + book.positions.reduce((n, p) => n + p.valueUsd, 0);
    return book;
  });
}

/** Adds each Solana token's average entry and P&L, from the wallet's recorded buys. */
export function withCostBasis(rows: PositionRow[], decimals: (mint: string) => number | undefined): PositionRow[] {
  return rows.map((r) => {
    if (r.kind !== "token") return r;
    const dec = decimals(r.asset);
    const cost = dec === undefined ? null : costOfHeld(r.w, r.asset, r.size, dec);
    if (cost === null || r.size <= 0) return r;
    return { ...r, entryPx: cost / r.size, pnlUsd: r.valueUsd - cost };
  });
}
