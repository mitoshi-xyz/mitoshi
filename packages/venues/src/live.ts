/** Public channels the relay's live feeds carry (they refuse anything that names a user). */
export type LiveSub =
  | { type: "allMids" }
  | { type: "candle"; coin: string; interval: string }
  | { type: "trades"; coin: string }
  | { type: "l2Book"; coin: string }
  | { type: "bbo"; coin: string }
  | { type: "activeAssetCtx"; coin: string }
  | { type: "market"; assetId: string };

export type LiveStatus = "connecting" | "live" | "reconnecting";

const PING_MS = 25_000;
const BACKOFF_START_MS = 500;
const BACKOFF_MAX_MS = 10_000;

/** Same key the relay routes by: type, then coin (or outcome id), then interval. */
export function liveKey(s: LiveSub): string {
  const id = "coin" in s ? s.coin : "assetId" in s ? s.assetId : undefined;
  return [s.type, id, "interval" in s ? s.interval : undefined].filter(Boolean).join(":");
}

type Listener = (data: unknown) => void;

/**
 * One WebSocket to a relay live feed (one per venue) per page, shared by every chart and table. Subscriptions
 * are counted, so two views watching BTC cost one upstream channel; they come back by themselves
 * after a reconnect.
 */
export class LiveFeed {
  private readonly url: string;
  private ws: WebSocket | null = null;
  private readonly subs = new Map<string, { sub: LiveSub; listeners: Set<Listener> }>();
  private readonly statusListeners = new Set<(s: LiveStatus) => void>();
  private status: LiveStatus = "connecting";
  private backoff = BACKOFF_START_MS;
  private ping: ReturnType<typeof setInterval> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  private setStatus(s: LiveStatus) {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  onStatus(l: (s: LiveStatus) => void): () => void {
    this.statusListeners.add(l);
    l(this.status);
    return () => this.statusListeners.delete(l);
  }

  private connect() {
    if (this.ws) return;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = BACKOFF_START_MS;
      this.setStatus("live");
      for (const { sub } of this.subs.values()) ws.send(JSON.stringify({ op: "sub", sub }));
      this.ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, PING_MS);
    };
    ws.onmessage = (e: MessageEvent<string>) => {
      if (e.data === "pong") return;
      const msg = JSON.parse(e.data) as { key?: string; data?: unknown };
      if (!msg.key) return;
      for (const l of this.subs.get(msg.key)?.listeners ?? []) l(msg.data);
    };
    ws.onclose = () => {
      if (this.ping) clearInterval(this.ping);
      this.ping = null;
      this.ws = null;
      if (this.subs.size === 0) return;
      this.setStatus("reconnecting");
      setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
    };
  }

  /** Starts receiving `sub`; returns the function that stops it. */
  subscribe(sub: LiveSub, listener: Listener): () => void {
    const key = liveKey(sub);
    let entry = this.subs.get(key);
    if (!entry) {
      entry = { sub, listeners: new Set() };
      this.subs.set(key, entry);
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: "sub", sub }));
    }
    entry.listeners.add(listener);
    this.connect();
    return () => {
      const e = this.subs.get(key);
      if (!e) return;
      e.listeners.delete(listener);
      if (e.listeners.size > 0) return;
      this.subs.delete(key);
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op: "unsub", sub }));
      if (this.subs.size === 0) this.ws?.close();
    };
  }
}
