import { DurableObject } from "cloudflare:workers";

/**
 * Live public market data. One object per venue keeps a single upstream WebSocket open and fans
 * public channels out to every browser watching. Only market channels are allowed: anything that
 * names a user (fills, orders, balances) is refused, so this edge never learns who owns which
 * wallet. The upstream connection is opened from an alarm, outside any visitor's request.
 */

const HL_WS = "https://api.hyperliquid.xyz/ws";
const PUBLIC_TYPES = new Set(["allMids", "candle", "l2Book", "trades", "bbo", "activeAssetCtx"]);
const INTERVALS = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"]);
const COIN = /^[A-Za-z0-9:_@-]{1,32}$/;
const MAX_SUBS_PER_SOCKET = 40;
const UPSTREAM_PING_MS = 30_000;
const RECONNECT_MS = 2_000;

interface Sub {
  type: string;
  coin?: string;
  interval?: string;
}

interface Attachment {
  subs: string[];
}

/** A canonical key for a subscription, matching how upstream messages are routed. */
function keyOf(s: Sub): string {
  return [s.type, s.coin, s.interval].filter(Boolean).join(":");
}

function subOf(key: string): Sub {
  const [type = "", coin, interval] = key.split(":");
  const s: Sub = { type };
  if (coin) s.coin = coin;
  if (interval) s.interval = interval;
  return s;
}

/** Validates a browser's subscription; null when it is not a public market channel. */
function parseSub(raw: unknown): Sub | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== "string" || !PUBLIC_TYPES.has(r.type) || "user" in r) return null;
  const s: Sub = { type: r.type };
  if (r.type !== "allMids") {
    if (typeof r.coin !== "string" || !COIN.test(r.coin)) return null;
    s.coin = r.coin;
  }
  if (r.type === "candle") {
    if (typeof r.interval !== "string" || !INTERVALS.has(r.interval)) return null;
    s.interval = r.interval;
  }
  return s;
}

/** Which subscription key an upstream message belongs to. */
function routeOf(msg: { channel?: string; data?: unknown }): string | null {
  const d = msg.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
  switch (msg.channel) {
    case "allMids":
      return "allMids";
    case "candle":
      return d && !Array.isArray(d) ? `candle:${d.s}:${d.i}` : null;
    case "trades":
      return Array.isArray(d) && d[0] ? `trades:${d[0].coin}` : null;
    case "l2Book":
    case "bbo":
    case "activeAssetCtx":
      return d && !Array.isArray(d) ? `${msg.channel}:${d.coin}` : null;
    default:
      return null;
  }
}

export class LiveFeed extends DurableObject<Record<string, unknown>> {
  private upstream: WebSocket | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    // Browsers keep their sockets alive with "ping"; answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") !== "websocket") return new Response("expected a WebSocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ subs: [] } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Every key some browser is subscribed to. */
  private wanted(): Set<string> {
    const keys = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      for (const k of (ws.deserializeAttachment() as Attachment | null)?.subs ?? []) keys.add(k);
    }
    return keys;
  }

  private sendUpstream(method: "subscribe" | "unsubscribe", key: string) {
    this.upstream?.send(JSON.stringify({ method, subscription: subOf(key) }));
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let msg: { op?: string; sub?: unknown };
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const sub = parseSub(msg.sub);
    if (!sub || (msg.op !== "sub" && msg.op !== "unsub")) {
      ws.send(JSON.stringify({ error: "only public market channels are available" }));
      return;
    }
    const key = keyOf(sub);
    const before = this.wanted();
    const att = (ws.deserializeAttachment() as Attachment | null) ?? { subs: [] };
    const subs = new Set(att.subs);
    if (msg.op === "sub") {
      if (subs.size >= MAX_SUBS_PER_SOCKET) return;
      subs.add(key);
    } else {
      subs.delete(key);
    }
    ws.serializeAttachment({ subs: [...subs] } satisfies Attachment);
    const after = this.wanted();
    if (!this.upstream) {
      if (after.size > 0) await this.ctx.storage.setAlarm(Date.now());
      return;
    }
    if (msg.op === "sub" && !before.has(key)) this.sendUpstream("subscribe", key);
    if (msg.op === "unsub" && !after.has(key)) this.sendUpstream("unsubscribe", key);
  }

  override async webSocketClose(ws: WebSocket) {
    ws.serializeAttachment({ subs: [] } satisfies Attachment);
    this.trim();
  }

  override async webSocketError(ws: WebSocket) {
    ws.serializeAttachment({ subs: [] } satisfies Attachment);
    this.trim();
  }

  /** Closes the upstream socket once nobody is watching anything. */
  private trim() {
    if (this.wanted().size === 0) this.closeUpstream();
  }

  private closeUpstream() {
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = null;
    this.upstream?.close();
    this.upstream = null;
  }

  /** Opens the upstream socket (from an alarm, never from a visitor's request). */
  override async alarm() {
    if (this.upstream || this.wanted().size === 0) return;
    const res = await fetch(HL_WS, { headers: { upgrade: "websocket" } });
    const ws = res.webSocket;
    if (!ws) {
      await this.ctx.storage.setAlarm(Date.now() + RECONNECT_MS);
      return;
    }
    ws.accept();
    this.upstream = ws;
    for (const key of this.wanted()) this.sendUpstream("subscribe", key);
    this.pinger = setInterval(() => ws.send(JSON.stringify({ method: "ping" })), UPSTREAM_PING_MS);
    ws.addEventListener("message", (e) => this.fanOut(e.data));
    const lost = () => {
      if (this.upstream !== ws) return;
      this.closeUpstream();
      if (this.wanted().size > 0) void this.ctx.storage.setAlarm(Date.now() + RECONNECT_MS);
    };
    ws.addEventListener("close", lost);
    ws.addEventListener("error", lost);
  }

  private fanOut(data: string | ArrayBuffer) {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);
    let msg: { channel?: string; data?: unknown };
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    const key = routeOf(msg);
    if (!key) return;
    const out = JSON.stringify({ key, data: msg.data });
    for (const ws of this.ctx.getWebSockets()) {
      const subs = (ws.deserializeAttachment() as Attachment | null)?.subs ?? [];
      if (subs.includes(key)) ws.send(out);
    }
  }
}
