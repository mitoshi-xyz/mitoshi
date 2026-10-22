"use client";

import { evmKey, type PrivateWallet } from "@mitoshi/engine";
import { createPrivateFetch } from "@mitoshi/net";
import { LiveFeed, PolymarketPerpsAccount, PolymarketPerpsMarket } from "@mitoshi/venues/pmperps";
import { RELAY } from "@/constants";
import { putWallet, walletById } from "../private-wallets/registry-store";
import { deviceSeed } from "../wallet/wallet-store";

/** Public Polymarket Perps data, over OHTTP like everything else. */
export const ppMarket = new PolymarketPerpsMarket(createPrivateFetch(RELAY));

let feed: LiveFeed | null = null;

/** The page's one Perps live-feed socket (the relay's /relay/live/pmperps; public channels only). */
export function ppLive(): LiveFeed {
  if (!feed) {
    const url = new URL(`${RELAY}/live/pmperps`, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    feed = new LiveFeed(url.toString());
  }
  return feed;
}

const accounts = new Map<string, Promise<PolymarketPerpsAccount>>();

/**
 * The Polymarket Perps account of one Polymarket private wallet. Its owner is the wallet's own
 * signer key (the same key that controls its Deposit Wallet); the proxy it authorises is kept,
 * encrypted, in the wallet's registry entry.
 */
export function ppAccount(w: PrivateWallet): Promise<PolymarketPerpsAccount> {
  let a = accounts.get(w.id);
  if (!a) {
    a = (async () => {
      if (w.venue !== "polymarket") throw new Error("Polymarket Perps trades from a Polymarket wallet");
      const owner = evmKey(await deviceSeed(), "polymarket", w.index).privateKey;
      return new PolymarketPerpsAccount(createPrivateFetch(RELAY), owner, walletById(w.id)?.perps ?? null, (perps) => {
        const latest = walletById(w.id);
        if (latest) putWallet({ ...latest, perps });
      });
    })();
    accounts.set(w.id, a);
    a.catch(() => accounts.delete(w.id));
  }
  return a;
}
