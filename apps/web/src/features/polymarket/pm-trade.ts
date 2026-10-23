"use client";

import { type PrivateWallet, positionWallet, type Registry } from "@mitoshi/engine";
import type { PmMarket } from "@mitoshi/venues/polymarket";
import { recordTrade } from "../private-wallets/home";
import { putWallet, walletById } from "../private-wallets/registry-store";
import { pmAccount, pmTradingAssets } from "./pm-account";

const MAX_PRICE = 0.99;
const MIN_PRICE = 0.01;
/** A market order may cross this many ticks past the estimate before it stops. */
const SLIPPAGE_TICKS = 2;
const CENTS = 100;

/**
 * Which wallet trades this market: the one already holding it (one position per wallet, so
 * adding or selling stays on it), otherwise a ready, never-used wallet for a new position.
 */
export function walletFor(r: Registry, conditionId: string): { wallet: PrivateWallet | undefined; holds: boolean } {
  return positionWallet(r, "polymarket", conditionId);
}

export interface PmOrder {
  wallet: PrivateWallet;
  market: PmMarket;
  outcome: number;
  side: "buy" | "sell";
  type: "market" | "limit";
  /** Buy at market: pUSD to spend. Sell at market and limit orders: shares. */
  amount: string;
  /** Limit price (0–1). */
  price?: string;
  onStep: (label: string) => void;
}

/**
 * Places one order from a private wallet. The first order opens the wallet's Deposit Wallet
 * (deployed gaslessly through Polymarket's relayer) and gives its trading approvals.
 */
export async function placePmOrder(o: PmOrder): Promise<{ ok: boolean; text: string }> {
  o.onStep("Opening your private Polymarket wallet");
  const account = await pmAccount(o.wallet);
  if (!walletById(o.wallet.id)?.prepared) {
    o.onStep("Setting up trading approvals (gasless)");
    await account.prepare();
    const w = walletById(o.wallet.id);
    if (w) putWallet({ ...w, prepared: true });
  }
  const [first, second] = await pmTradingAssets(o.market.id);
  const assetId = o.outcome === 0 ? first : second;
  const label = o.market.outcomes[o.outcome]?.label ?? "outcome";
  o.onStep("Signing with this wallet's own key");
  let res: { ok: boolean; orderId: string | null; message: string | null };
  if (o.type === "limit") {
    res = await account.limit(assetId, o.side, o.price ?? "0", o.amount);
  } else {
    const est = await account.estimate(assetId, o.side, o.amount);
    const tick = o.market.tickSize;
    res =
      o.side === "buy"
        ? await account.buy(assetId, o.amount, Math.min(MAX_PRICE, est + SLIPPAGE_TICKS * tick))
        : await account.sell(assetId, o.amount, Math.max(MIN_PRICE, est - SLIPPAGE_TICKS * tick));
  }
  if (!res.ok) return { ok: false, text: res.message ?? "Polymarket refused the order" };
  const verb = o.side === "buy" ? "Bought" : "Sold";
  recordTrade(o.wallet.id, {
    at: Date.now(),
    label: `${verb} ${label} · ${o.market.title}`,
    asset: o.market.conditionId,
    side: o.side,
    inAmount: o.amount,
    outAmount: o.price ?? "",
    usd: o.side === "buy" && o.type === "market" ? Number(o.amount) : null,
    ...(res.orderId ? { ref: res.orderId } : {}),
  });
  return {
    ok: true,
    text: o.type === "limit" ? `Limit order resting at ${Math.round(Number(o.price) * CENTS)}¢` : `${verb} ${label}`,
  };
}
