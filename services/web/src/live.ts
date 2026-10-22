import { DurableObject } from "cloudflare:workers";

/**
 * Live public market data (Hyperliquid, Polymarket, Polymarket Perps). One object per venue keeps a single upstream WebSocket open and fans
 * public channels out to every browser watching. Only market channels are allowed: anything that
 * names a user (fills, orders, balances) is refused, so this edge never learns who owns which
 * wallet. The upstream connection is opened from an alarm, outside any visitor's request.
 */

const MAX_SUBS_PER_SOCKET = 40;
const RECONNECT_MS = 2_000;

interface Sub {
  type: string;
  coin?: string;
  interval?: string;
  assetId?: string;
}

interface Attachment {
  subs: string[];
}

/** How one venue's public WebSocket is spoken. Keys look like "type:coin:interval". */
interface Protocol {
  url: string;
  pingFrame: string;
  pingMs: number;
  /** Validates a browser's subscription; null when it is not a public market channel. */
  parse(raw: Record<string, unknown>): Sub | null;
  /** Frames that add keys (`first` is the first frame on a new connection). */
  subscribe(keys: string[], first: boolean): string[];
  unsubscribe(keys: string[]): string[];
  /** Splits an upstream message into (key, data) pairs for the browsers watching. */
  route(text: string): { key: string; data: unknown }[];
  /** Keys whose updates are held and sent at most once per COALESCE_MS (only the latest one). */
  coalesce?(key: string): boolean;
}

/** Tickers arrive several times a second per instrument; browsers only need the latest once a second. */
const COALESCE_MS = 1_000;

/** A canonical key for a subscription, matching how upstream messages are routed. */
function keyOf(s: Sub): string {
  return [s.type, s.coin ?? s.assetId, s.interval].filter(Boolean).join(":");
}

function hlSub(key: string): Sub {
  const [type = "", coin, interval] = key.split(":");
  const s: Sub = { type };
  if (coin) s.coin = coin;
  if (interval) s.interval = interval;
  return s;
}

const HL_TYPES = new Set(["allMids", "candle", "l2Book", "trades", "bbo", "activeAssetCtx"]);
const HL_INTERVALS = new Set(["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "8h", "12h", "1d", "3d", "1w", "1M"]);
const COIN = /^[A-Za-z0-9:_@-]{1,32}$/;

/** Hyperliquid (hyperliquid.gitbook.io/.../websocket/subscriptions). */
const hyperliquid: Protocol = {
  url: "https://api.hyperliquid.xyz/ws",
  pingFrame: JSON.stringify({ method: "ping" }),
  pingMs: 30_000,
  parse(r) {
    if (typeof r.type !== "string" || !HL_TYPES.has(r.type) || "user" in r) return null;
    const s: Sub = { type: r.type };
    if (r.type !== "allMids") {
      if (typeof r.coin !== "string" || !COIN.test(r.coin)) return null;
      s.coin = r.coin;
    }
    if (r.type === "candle") {
      if (typeof r.interval !== "string" || !HL_INTERVALS.has(r.interval)) return null;
      s.interval = r.interval;
    }
    return s;
  },
  subscribe: (keys) => keys.map((k) => JSON.stringify({ method: "subscribe", subscription: hlSub(k) })),
  unsubscribe: (keys) => keys.map((k) => JSON.stringify({ method: "unsubscribe", subscription: hlSub(k) })),
  route(text) {
    const msg = JSON.parse(text) as { channel?: string; data?: unknown };
    const d = msg.data as Record<string, unknown> | Record<string, unknown>[] | undefined;
    let key: string | null = null;
    if (msg.channel === "allMids") key = "allMids";
    else if (msg.channel === "candle" && d && !Array.isArray(d)) key = `candle:${d.s}:${d.i}`;
    else if (msg.channel === "trades" && Array.isArray(d) && d[0]) key = `trades:${d[0].coin}`;
    else if (
      (msg.channel === "l2Book" || msg.channel === "bbo" || msg.channel === "activeAssetCtx") &&
      d &&
      !Array.isArray(d)
    ) {
      key = `${msg.channel}:${d.coin}`;
    }
    return key ? [{ key, data: msg.data }] : [];
  },
};

const ASSET_ID = /^\d{1,100}$/;
const assetOf = (key: string) => key.split(":")[1] ?? "";

/** Polymarket's public market channel (docs.polymarket.com, "Market Channel"). */
const polymarket: Protocol = {
  url: "https://ws-subscriptions-clob.polymarket.com/ws/market",
  pingFrame: "PING",
  pingMs: 10_000,
  parse(r) {
    if (r.type !== "market" || typeof r.assetId !== "string" || !ASSET_ID.test(r.assetId)) return null;
    return { type: "market", assetId: r.assetId };
  },
  subscribe: (keys, first) =>
    keys.length === 0
      ? []
      : [
          JSON.stringify(
            first
              ? { assets_ids: keys.map(assetOf), type: "market", custom_feature_enabled: true }
              : { assets_ids: keys.map(assetOf), operation: "subscribe", custom_feature_enabled: true },
          ),
        ],
  unsubscribe: (keys) =>
    keys.length ? [JSON.stringify({ assets_ids: keys.map(assetOf), operation: "unsubscribe" })] : [],
  route(text) {
    if (text === "PONG") return [];
    const parsed = JSON.parse(text) as Record<string, unknown> | Record<string, unknown>[];
    const events = Array.isArray(parsed) ? parsed : [parsed];
    const out: { key: string; data: unknown }[] = [];
    for (const e of events) {
      if (typeof e.asset_id === "string") out.push({ key: `market:${e.asset_id}`, data: e });
      if (Array.isArray(e.price_changes)) {
        for (const c of e.price_changes as Record<string, unknown>[]) {
          out.push({ key: `market:${c.asset_id}`, data: { ...e, price_changes: [c] } });
        }
      }
      if (Array.isArray(e.assets_ids)) {
        for (const id of e.assets_ids as string[]) out.push({ key: `market:${id}`, data: e });
      }
    }
    return out;
  },
};

const PERPS_TYPES = new Set(["bbo", "trades", "tickers", "klines", "statistics"]);
/** Channels that also come as one stream for every instrument (`tickers::all`). */
const PERPS_ALL = new Set(["tickers", "statistics"]);
const PERPS_INTERVALS = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1d", "1w"]);
const INSTRUMENT = /^\d{1,6}$/;
/** Our key "klines:6:1m" is Polymarket's channel "klines::6::1m". */
const perpsChannel = (key: string) => key.split(":").join("::");

/** Polymarket Perps' public market data (docs.polymarket.com/perps/realtime-updates). */
const pmperps: Protocol = {
  url: "https://ws.perpetuals.polymarket.com/v1/ws",
  // Docs (AsyncAPI "Ping"): idle connections close after 60 s; ping keeps them open.
  pingFrame: JSON.stringify({ req: "post", op: { type: "ping" } }),
  pingMs: 30_000,
  parse(r) {
    if (typeof r.type !== "string" || !PERPS_TYPES.has(r.type)) return null;
    const id = r.coin;
    if (typeof id !== "string" || !(INSTRUMENT.test(id) || (id === "all" && PERPS_ALL.has(r.type)))) return null;
    const s: Sub = { type: r.type, coin: id };
    if (r.type === "klines") {
      if (typeof r.interval !== "string" || !PERPS_INTERVALS.has(r.interval)) return null;
      s.interval = r.interval;
    }
    return s;
  },
  subscribe: (keys) => (keys.length ? [JSON.stringify({ req: "sub", chs: keys.map(perpsChannel) })] : []),
  unsubscribe: (keys) => (keys.length ? [JSON.stringify({ req: "unsub", chs: keys.map(perpsChannel) })] : []),
  route(text) {
    const msg = JSON.parse(text) as { ch?: string; data?: unknown };
    if (typeof msg.ch !== "string") return [];
    const key = msg.ch.split("::").join(":");
    const [type = ""] = key.split(":");
    const out = [{ key, data: msg.data }];
    if (PERPS_ALL.has(type)) out.push({ key: `${type}:all`, data: msg.data });
    return out;
  },
  coalesce: (key) => PERPS_ALL.has(key.split(":")[0] ?? ""),
};

export const PROTOCOLS: Record<string, Protocol> = { hyperliquid, polymarket, pmperps };

export class LiveFeed extends DurableObject<Record<string, unknown>> {
  private upstream: WebSocket | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;
  private flusher: ReturnType<typeof setInterval> | null = null;
  /** Coalesced updates waiting for the next flush; for an ":all" key, the latest per instrument. */
  private held = new Map<string, unknown>();
  private protocol: Protocol | null = null;

  constructor(ctx: DurableObjectState, env: Record<string, unknown>) {
    super(ctx, env);
    // Browsers keep their sockets alive with "ping"; answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  /** Which venue this object speaks for (from the URL; kept so an alarm after eviction knows). */
  private async venue(request?: Request): Promise<Protocol | null> {
    if (this.protocol) return this.protocol;
    let name = request ? new URL(request.url).pathname.split("/").pop() : undefined;
    if (name && PROTOCOLS[name]) await this.ctx.storage.put("venue", name);
    else name = await this.ctx.storage.get<string>("venue");
    this.protocol = (name && PROTOCOLS[name]) || null;
    return this.protocol;
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("upgrade") !== "websocket") return new Response("expected a WebSocket", { status: 426 });
    if (!(await this.venue(request))) return new Response("unknown feed", { status: 404 });
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

  private sendUpstream(frames: string[]) {
    for (const f of frames) this.upstream?.send(f);
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    let msg: { op?: string; sub?: unknown };
    try {
      msg = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message));
    } catch {
      return;
    }
    const protocol = await this.venue();
    const raw = msg.sub && typeof msg.sub === "object" ? (msg.sub as Record<string, unknown>) : null;
    const sub = protocol && raw ? protocol.parse(raw) : null;
    if (!protocol || !sub || (msg.op !== "sub" && msg.op !== "unsub")) {
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
    if (msg.op === "sub" && !before.has(key)) this.sendUpstream(protocol.subscribe([key], false));
    if (msg.op === "unsub" && !after.has(key)) this.sendUpstream(protocol.unsubscribe([key]));
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
    if (this.flusher) clearInterval(this.flusher);
    this.pinger = null;
    this.flusher = null;
    this.held.clear();
    this.upstream?.close();
    this.upstream = null;
  }

  /** Opens the upstream socket (from an alarm, never from a visitor's request). */
  override async alarm() {
    const protocol = await this.venue();
    if (!protocol || this.upstream || this.wanted().size === 0) return;
    const res = await fetch(protocol.url, { headers: { upgrade: "websocket" } });
    const ws = res.webSocket;
    if (!ws) {
      await this.ctx.storage.setAlarm(Date.now() + RECONNECT_MS);
      return;
    }
    ws.accept();
    this.upstream = ws;
    this.sendUpstream(protocol.subscribe([...this.wanted()], true));
    this.pinger = setInterval(() => ws.send(protocol.pingFrame), protocol.pingMs);
    if (protocol.coalesce) this.flusher = setInterval(() => this.flush(), COALESCE_MS);
    ws.addEventListener("message", (e) => this.fanOut(protocol, e.data));
    const lost = () => {
      if (this.upstream !== ws) return;
      this.closeUpstream();
      if (this.wanted().size > 0) void this.ctx.storage.setAlarm(Date.now() + RECONNECT_MS);
    };
    ws.addEventListener("close", lost);
    ws.addEventListener("error", lost);
  }

  private fanOut(protocol: Protocol, data: string | ArrayBuffer) {
    const text = typeof data === "string" ? data : new TextDecoder().decode(data);
    let routed: { key: string; data: unknown }[];
    try {
      routed = protocol.route(text);
    } catch {
      return;
    }
    const now = routed.filter((r) => {
      if (!protocol.coalesce?.(r.key)) return true;
      // ":all" streams hold one update per instrument; single keys hold the latest.
      const id = (r.data as { iid?: unknown } | null)?.iid;
      this.held.set(r.key.endsWith(":all") ? `${r.key}\n${String(id)}` : r.key, r.data);
      return false;
    });
    this.send(now);
  }

  /** Sends the held updates (each once) and forgets them. */
  private flush() {
    if (this.held.size === 0) return;
    const out = [...this.held].map(([k, data]) => ({ key: k.split("\n")[0] ?? k, data }));
    this.held.clear();
    this.send(out);
  }

  private send(routed: { key: string; data: unknown }[]) {
    if (routed.length === 0) return;
    const sockets = this.ctx.getWebSockets().map((ws) => ({
      ws,
      subs: new Set((ws.deserializeAttachment() as Attachment | null)?.subs ?? []),
    }));
    for (const { key, data: payload } of routed) {
      const out = JSON.stringify({ key, data: payload });
      for (const { ws, subs } of sockets) if (subs.has(key)) ws.send(out);
    }
  }
}
