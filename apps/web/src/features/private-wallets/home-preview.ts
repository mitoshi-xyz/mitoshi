"use client";

import { type PrivateWallet, ZAT_PER_ZEC } from "@mitoshi/engine";
import { ASSETS, type AssetKey, type QuoteResponse } from "@mitoshi/rails";
import { DUST_USDC, HL_ACTIVATION_FEE_USDC } from "@mitoshi/venues/hyperliquid";
import { PUSD_DECIMALS } from "@mitoshi/venues/polymarket";
import { LAMPORTS_PER_SOL, SOL_MINT } from "@mitoshi/venues/solana";
import { hlAccount } from "../hyperliquid/hl";
import { pmDriver } from "../perps/pm-driver";
import { pmBridge, pmMarket } from "../polymarket/pm";
import { solAccount, solMarket } from "../solana/sol";
import { freshAddress } from "../wallet/wallet-store";
import { quote } from "./swaps";
import { VENUES } from "./venues";

const CENTS = 100;
const CENTS_TO_BASE = 10 ** (ASSETS.hypercoreUsdc.decimals - 2);
const PUSD_UNITS = 10 ** PUSD_DECIMALS;
/** Under a dollar of pUSD stays (the trip home's own rule). */
const PUSD_DUST = 1;
/** A leftover under a cent isn't worth a row. */
const SHOWN_USD = 0.01;
const USD_DIGITS = 2;

/** Where a part of the wallet's money goes on the way home. */
export type HomeLegKind = "home" | "venue" | "near" | "payout" | "stays";

export interface HomeLeg {
  kind: HomeLegKind;
  label: string;
  usd: number;
}

export interface HomePreview {
  /** Everything the wallet holds, at today's prices, and in its own units ("6.21 USDC"). */
  heldUsd: number;
  held: string;
  /** What reaches the shielded balance. */
  outZat: number;
  outUsd: number;
  /** Every part of `heldUsd`, home first; they add up to it. */
  legs: HomeLeg[];
  /** The costs that are the same whatever the amount. */
  fixedUsd: number;
  seconds: number;
  /** Why it can't go yet (open positions to close first). */
  blocked: string | null;
  /** Less than the trip home costs: nothing would arrive. */
  dust: boolean;
}

/** A dry quote home to a fresh shielded address; refunds would go back to the wallet. Nothing moves. */
async function homeQuote(from: AssetKey, amount: string, refundTo: string, flexible = false): Promise<QuoteResponse> {
  return quote({
    from,
    to: "zec",
    amount,
    recipient: await freshAddress(),
    refundTo,
    dry: true,
    ...(flexible ? { flexible: true } : {}),
  });
}

/**
 * NEAR's part, from its own quote. `amountOutUsd` is what arrives (already less the payout fee), so the payout fee
 * (`withdrawFee`, in zat) comes out first and the rest of the gap is the swap and its route.
 */
function nearParts(q: QuoteResponse) {
  const outZat = Number(q.quote.amountOut);
  const outUsd = Number(q.quote.amountOutUsd);
  const inUsd = Number(q.quote.amountInUsd);
  const zecUsd = outZat > 0 ? outUsd / (outZat / ZAT_PER_ZEC) : 0;
  const payoutUsd = (Number(q.quote.withdrawFee ?? 0) / ZAT_PER_ZEC) * zecUsd;
  return {
    outZat,
    outUsd,
    inUsd,
    payoutUsd,
    swapUsd: Math.max(0, inUsd - outUsd - payoutUsd),
    seconds: q.quote.timeEstimate,
  };
}

const units = (n: number, symbol: string) => `${n.toFixed(USD_DIGITS)} ${symbol}`;

function dust(heldUsd: number, held: string, blocked: string | null = null): HomePreview {
  return { heldUsd, held, outZat: 0, outUsd: 0, legs: [], fixedUsd: 0, seconds: 0, blocked, dust: true };
}

/** Puts the parts together: home first, then each cost in the order the money meets it, then what stays behind. */
function assemble(
  w: PrivateWallet,
  held: string,
  heldUsd: number,
  q: QuoteResponse,
  venue: HomeLeg[],
  fixedVenueUsd: number,
  blocked: string | null,
): HomePreview {
  const n = nearParts(q);
  const legs: HomeLeg[] = [
    { kind: "home", label: "Home, shielded", usd: n.outUsd },
    ...venue.filter((l) => l.usd >= SHOWN_USD),
    { kind: "near", label: "NEAR swap", usd: n.swapUsd },
    { kind: "payout", label: "Zcash payout fee", usd: n.payoutUsd },
  ];
  const stays = heldUsd - legs.reduce((s, l) => s + l.usd, 0);
  if (stays >= SHOWN_USD) legs.push({ kind: "stays", label: `Stays on ${VENUES[w.venue].name}`, usd: stays });
  return {
    heldUsd,
    held,
    outZat: n.outZat,
    outUsd: n.outUsd,
    legs,
    fixedUsd: fixedVenueUsd + n.payoutUsd,
    seconds: n.seconds,
    blocked,
    dust: n.outZat <= 0,
  };
}

const closeFirst = (open: number) =>
  open ? `Close your ${open === 1 ? "position" : `${open} positions`} first` : null;

/** Hyperliquid: every USDC gathered, less the 1 USDC Hyperliquid charges to open NEAR's new deposit address. */
async function hyperliquid(w: PrivateWallet): Promise<HomePreview> {
  const v = await (await hlAccount(w)).homeValue();
  const send = Math.floor((v.usdc - HL_ACTIVATION_FEE_USDC) * CENTS) / CENTS;
  const blocked = closeFirst(v.open);
  const gross = v.usdc + v.closeFee;
  if (send < DUST_USDC) return dust(gross, units(gross, "USDC"), blocked);
  const q = await homeQuote("hypercoreUsdc", String(Math.round(send * CENTS) * CENTS_TO_BASE), w.address);
  // NEAR's own price for USDC (a hair under $1), so every part is in the same dollars.
  const rate = Number(q.quote.amountInUsd) / send;
  return assemble(
    w,
    units(gross, "USDC"),
    gross * rate,
    q,
    [
      { kind: "venue", label: "Closing at market", usd: v.closeFee * rate },
      { kind: "venue", label: "Hyperliquid's new-address fee", usd: HL_ACTIVATION_FEE_USDC * rate },
    ],
    HL_ACTIVATION_FEE_USDC * rate,
    blocked,
  );
}

/** Polymarket: pUSD, shares at today's price and any Perps money, through Polymarket's bridge to Polygon USDC. */
async function polymarket(w: PrivateWallet): Promise<HomePreview> {
  const [account, shares, stranded] = await Promise.all([
    pmDriver.account(w),
    pmMarket.positions(w.address),
    pmMarket.usdc(w.address),
  ]);
  const held = account.equity + stranded + shares.filter((p) => p.size > 0).reduce((n, p) => n + p.valueUsd, 0);
  const blocked = closeFirst(account.positions.length);
  if (held < PUSD_DUST) return dust(held, units(held, "pUSD"), blocked);
  const out = await pmBridge.quote("out", String(Math.floor(held * PUSD_UNITS)), w.address);
  const q = await homeQuote("polygonUsdc", out.out, w.address, true);
  const bridged = Number(out.out) / PUSD_UNITS;
  return assemble(
    w,
    units(held, "pUSD"),
    held,
    q,
    [{ kind: "venue", label: "Polymarket's bridge", usd: held - bridged }],
    0,
    blocked,
  );
}

/** Solana: every token sold back to SOL at Jupiter's price, then the SOL. */
async function solana(w: PrivateWallet): Promise<HomePreview> {
  const account = await solAccount(w);
  const [h, lamports] = await Promise.all([account.holdings(), account.sendable()]);
  const [sold, prices] = await Promise.all([
    Promise.all(
      h.tokens.map((t) =>
        solMarket
          .quote(t.mint, SOL_MINT, t.amount)
          .then((s) => s.outAmount)
          .catch(() => 0n),
      ),
    ),
    solMarket.prices(h.tokens.map((t) => t.mint)),
  ]);
  const total = sold.reduce((n, x) => n + x, lamports);
  const tokensUsd = h.tokens.reduce((n, t) => n + t.uiAmount * (prices[t.mint] ?? 0), 0);
  const sol = Number(total) / LAMPORTS_PER_SOL;
  if (total === 0n) return dust(tokensUsd, units(sol, "SOL"));
  const q = await homeQuote("sol", total.toString(), w.address);
  const rate = Number(q.quote.amountInUsd) / sol;
  const soldUsd = (Number(total - lamports) / LAMPORTS_PER_SOL) * rate;
  return assemble(
    w,
    h.tokens.length ? `${units(sol, "SOL")} after selling` : units(sol, "SOL"),
    (Number(lamports) / LAMPORTS_PER_SOL) * rate + Math.max(tokensUsd, soldUsd),
    q,
    [{ kind: "venue", label: "Selling tokens to SOL", usd: Math.max(0, tokensUsd - soldUsd) }],
    0,
    null,
  );
}

/** What sending a wallet home would bring, and where every other dollar goes. Read only; nothing moves. */
export function previewHome(w: PrivateWallet): Promise<HomePreview> {
  if (w.venue === "hyperliquid") return hyperliquid(w);
  if (w.venue === "solana") return solana(w);
  return polymarket(w);
}
