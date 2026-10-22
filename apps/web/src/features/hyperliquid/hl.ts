"use client";

import { evmKey, type PrivateWallet } from "@mitoshi/engine";
import { createPrivateFetch } from "@mitoshi/net";
import { HyperliquidAccount, HyperliquidMarket, LiveFeed } from "@mitoshi/venues/hyperliquid";
import { RELAY } from "@/constants";
import { deviceSeed } from "../wallet/wallet-store";

/** Public Hyperliquid data, over OHTTP like everything else. */
export const hlMarket = new HyperliquidMarket(createPrivateFetch(RELAY));

let feed: LiveFeed | null = null;

/** The page's one live-feed socket (same origin in production: /relay/live/hyperliquid). */
export function hlLive(): LiveFeed {
  if (!feed) {
    const url = new URL(`${RELAY}/live/hyperliquid`, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    feed = new LiveFeed(url.toString());
  }
  return feed;
}

const accounts = new Map<string, HyperliquidAccount>();

/** The Hyperliquid account of one private wallet, signing with that wallet's own key. */
export async function hlAccount(w: PrivateWallet): Promise<HyperliquidAccount> {
  const cached = accounts.get(w.id);
  if (cached) return cached;
  const { privateKey } = evmKey(await deviceSeed(), "hyperliquid", w.index);
  const account = new HyperliquidAccount(createPrivateFetch(RELAY), privateKey);
  if (account.address.toLowerCase() !== w.address.toLowerCase())
    throw new Error("wallet key does not match its address");
  accounts.set(w.id, account);
  return account;
}
