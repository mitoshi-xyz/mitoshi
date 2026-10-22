/// <reference lib="webworker" />
/**
 * The Polymarket worker: runs the official SDK for the private wallets, and nothing else.
 *
 * The SDK makes its own HTTP calls (CLOB, relayer, data, Polygon RPC). In this worker the global
 * `fetch` is replaced by the OHTTP fetch, so every one of them is sealed for the gateway and goes
 * out through the relay; only the relay's own endpoint is reached directly. Keys arrive one per
 * private wallet and stay in this worker's memory.
 */
import { createPrivateFetch, RELAY_PATHS } from "@mitoshi/net";
import { PolymarketAccount, tradingAssets } from "@mitoshi/venues/polymarket/trading";
import type { PmCall, PmReply } from "./pm-protocol";

declare const self: DedicatedWorkerGlobalScope;

const native = self.fetch.bind(self);
let relayEndpoint: string | null = null;
let sealed: ((url: string, init?: RequestInit) => Promise<Response>) | null = null;

/** A Request (as the SDK's HTTP library passes one) as a URL and its parts. */
async function parts(input: RequestInfo | URL, init?: RequestInit): Promise<[string, RequestInit | undefined]> {
  if (!(input instanceof Request)) return [String(input), init];
  const body = input.method === "GET" || input.method === "HEAD" ? undefined : await input.arrayBuffer();
  return [input.url, { method: input.method, headers: input.headers, ...(body ? { body } : {}), ...init }];
}

self.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (relayEndpoint && url.startsWith(relayEndpoint)) return native(input, init);
  const send = sealed;
  if (!send) return Promise.reject(new Error("the Polymarket worker has no relay yet"));
  return parts(input, init).then(([u, i]) => send(u, i));
};

const accounts = new Map<string, Promise<PolymarketAccount>>();

function account(key: `0x${string}`): Promise<PolymarketAccount> {
  let a = accounts.get(key);
  if (!a) {
    a = PolymarketAccount.open(key);
    accounts.set(key, a);
    a.catch(() => accounts.delete(key));
  }
  return a;
}

async function handle(call: PmCall): Promise<unknown> {
  if (call.kind === "init") {
    const base = new URL(call.relay, call.origin).toString().replace(/\/$/, "");
    relayEndpoint = `${base}${RELAY_PATHS.ohttp}`;
    sealed = createPrivateFetch(base);
    return true;
  }
  if (call.kind === "assets") return tradingAssets(call.marketId);
  const a = await account(call.key);
  switch (call.kind) {
    case "open":
      return { signer: a.signer, wallet: a.wallet };
    case "prepare":
      return a.prepare();
    case "buy":
      return a.buy(call.assetId, call.usd, call.maxPrice);
    case "sell":
      return a.sell(call.assetId, call.shares, call.minPrice);
    case "limit":
      return a.limit(call.assetId, call.side, call.price, call.size);
    case "estimate":
      return a.estimate(call.assetId, call.side, call.amount);
    case "cancel":
      return a.cancel(call.orderId);
    case "openOrders":
      return a.openOrders();
    case "redeem":
      return a.redeem(call.conditionId);
    case "sendPusd":
      return a.sendPusd(call.to, BigInt(call.amount));
  }
}

self.onmessage = (e: MessageEvent<PmCall & { id: number }>) => {
  const { id } = e.data;
  handle(e.data).then(
    (ok) => self.postMessage({ id, ok } satisfies PmReply),
    (err: unknown) =>
      self.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies PmReply),
  );
};
