"use client";

import { createPrivateFetch, proxiedImage } from "@mitoshi/net";
import { LiveFeed, PolymarketBridge, PolymarketMarket } from "@mitoshi/venues/polymarket";
import { RELAY } from "@/constants";

/** Public Polymarket data, over OHTTP. */
export const pmMarket = new PolymarketMarket(createPrivateFetch(RELAY));

/** Polymarket's bridge (fundings in, trips home out), over OHTTP. */
export const pmBridge = new PolymarketBridge(createPrivateFetch(RELAY));

let feed: LiveFeed | null = null;

/** The page's Polymarket live-feed socket (/relay/live/polymarket). */
export function pmLive(): LiveFeed {
  if (!feed) {
    const url = new URL(`${RELAY}/live/polymarket`, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    feed = new LiveFeed(url.toString());
  }
  return feed;
}

/** A market picture through the relay's image proxy (the image host never sees the browser). */
export function pmImage(src: string | null): string | null {
  return src ? proxiedImage(RELAY, src) : null;
}
