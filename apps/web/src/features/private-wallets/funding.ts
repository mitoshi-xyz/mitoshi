"use client";

import {
  checkFunding,
  type LeakReport,
  type PrivateWallet,
  throwawayAddress,
  type Venue,
  walletAddress,
} from "@mitoshi/engine";
import { ASSETS, type AssetKey, formatUnits, OneClickError, type QuoteResponse, type SwapInput } from "@mitoshi/rails";
import { BRIDGE_SOURCES, depositWalletAddress, PUSD_DECIMALS } from "@mitoshi/venues/polymarket";
import { ZEC_NETWORK } from "@/constants";
import { pmBridge } from "../polymarket/pm";
import { freshAddress, money, walletState } from "../wallet/wallet-store";
import { quote } from "./swaps";

/** Funding routes, previews and addresses: what a new private wallet would get, and where it is sent. */

/** What each venue's wallet is funded with on arrival. */
export const VENUE_ASSET: Record<Venue, AssetKey> = {
  polymarket: "polygonUsdc",
  hyperliquid: "hypercoreUsdc",
  solana: "sol",
};

/**
 * The routes a venue's funding may take, best first: the first one NEAR will quote is used. NEAR's
 * pairs come and go (ZEC → Polygon USDC was unavailable on 2026-10-22 while Arbitrum and Base
 * quoted), and Polymarket's bridge takes USDC from any of them.
 */
export const FUNDING_ROUTES: Record<Venue, AssetKey[]> = {
  polymarket: ["polygonUsdc", "arbitrumUsdc", "baseUsdc"],
  hyperliquid: ["hypercoreUsdc"],
  solana: ["sol"],
};

/** 1Click's answer when a pair or token has no route right now. */
const NO_ROUTE = /not available|tokenOut is not valid/i;

export async function routedQuote(
  venue: Venue,
  input: Omit<SwapInput, "to">,
): Promise<{ q: QuoteResponse; to: AssetKey }> {
  let last: unknown = new Error("no funding route");
  for (const to of FUNDING_ROUTES[venue]) {
    try {
      return { q: await quote({ ...input, to }), to };
    } catch (e) {
      if (!(e instanceof OneClickError) || !NO_ROUTE.test(e.message)) throw e;
      last = e;
    }
  }
  throw last;
}

/** A funding's network fee is checked for real before sending; this reserve is for showing sizes. */
export const FUNDING_FEE_RESERVE_ZAT = 15_000;

export function canFund(): { ok: boolean; why?: string } {
  if (ZEC_NETWORK !== "main") {
    return { ok: false, why: "Private wallets are funded through NEAR Intents, which only takes mainnet ZEC." };
  }
  return { ok: true };
}

/** What the rested, spendable balance allows. */
export function balances() {
  const { spendable, resting } = money(walletState().summary?.balance);
  return { spendable, resting };
}

export interface FundingPreview {
  out: string;
  symbol: string;
  /** The chain the funding arrives on, when a venue has several routes ("Arbitrum"). */
  via: string | null;
  /** Polymarket: what the bridge credits after NEAR delivers (USDC → pUSD), and its fee. */
  credited?: { out: string; symbol: string; feeUsd: number };
  usd: string;
  seconds: number;
  quote: QuoteResponse;
  leak: LeakReport;
}

/**
 * The address a new wallet is known by on its venue: the signer itself, except on Polymarket,
 * where it is the signer's Deposit Wallet (derived, so it is known before it exists on chain).
 */
export function venueAddress(seed: Uint8Array, venue: Venue, index: number): string {
  const signer = walletAddress(seed, venue, index);
  return venue === "polymarket" ? depositWalletAddress(signer as `0x${string}`) : signer;
}

/** Where NEAR delivers a funding: the wallet itself, or on Polymarket its bridge address (USDC → pUSD). */
export function fundingRecipient(w: Pick<PrivateWallet, "venue" | "address">): Promise<string> {
  return w.venue === "polymarket" ? pmBridge.depositAddress(w.address) : Promise.resolve(w.address);
}

/** A dry quote for funding a new wallet of `sizeZat` on `venue` (nothing moves). */
export async function previewFunding(venue: Venue, sizeZat: number): Promise<FundingPreview> {
  const allowed = canFund();
  if (!allowed.ok) throw new Error(allowed.why);
  // A throwaway recipient: quoting the next wallet's real address would announce it before its random funding time.
  const recipient = throwawayAddress(venue);
  const refundTo = await freshAddress();
  const { q, to } = await routedQuote(venue, {
    from: "zec",
    amount: String(sizeZat),
    recipient,
    refundTo,
    dry: true,
    appFee: true,
  });
  const asset = ASSETS[to];
  const { spendable, resting } = balances();
  const bridged =
    venue === "polymarket" && to in BRIDGE_SOURCES
      ? await pmBridge
          .quote("in", q.quote.amountOut, recipient, BRIDGE_SOURCES[to as keyof typeof BRIDGE_SOURCES])
          .catch(() => null)
      : null;
  return {
    ...(bridged
      ? { credited: { out: formatUnits(bridged.out, PUSD_DECIMALS), symbol: "pUSD", feeUsd: bridged.feeUsd } }
      : {}),
    via: to in BRIDGE_SOURCES ? BRIDGE_SOURCES[to as keyof typeof BRIDGE_SOURCES].name : null,
    out: formatUnits(q.quote.amountOut, asset.decimals),
    symbol: asset.symbol,
    usd: q.quote.amountOutUsd,
    seconds: q.quote.timeEstimate,
    quote: q,
    leak: checkFunding({
      amountZat: sizeZat,
      feeZat: FUNDING_FEE_RESERVE_ZAT,
      spendableZat: spendable,
      restingZat: resting,
    }),
  };
}
