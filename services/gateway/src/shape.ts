/**
 * Shapes for public listings: the fields the app reads, nothing else. Polymarket's event listings carry every
 * market with every field, and an evening of NBA games (300+ player-prop markets each) makes one page 10 MB: more
 * than one OHTTP message or a Vercel response can hold, so the listing failed. A single event (/events/{id}) is
 * never shaped; the event page reads it in full.
 */

type Json = Record<string, unknown>;

/** What an event card, the palette and the markets page read from an event (packages/venues/src/polymarket). */
const EVENT_FIELDS = [
  "id",
  "slug",
  "title",
  "image",
  "icon",
  "endDate",
  "volume24hr",
  "volume",
  "liquidity",
  "negRisk",
  "closed",
];
/** What a card reads from each market: prices, tokens and state; no rules text. */
const MARKET_FIELDS = [
  "id",
  "question",
  "groupItemTitle",
  "conditionId",
  "outcomes",
  "outcomePrices",
  "clobTokenIds",
  "volume24hr",
  "volumeNum",
  "liquidityNum",
  "endDate",
  "closed",
  "acceptingOrders",
  "orderPriceMinTickSize",
  "orderMinSize",
  "negRisk",
  "image",
  "bestBid",
  "bestAsk",
  "lastTradePrice",
  "archived",
  "active",
];

const pick = (o: Json, keys: readonly string[]): Json =>
  Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
const isJson = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

function eventForList(e: unknown): unknown {
  if (!isJson(e)) return e;
  const tags = Array.isArray(e.tags) ? e.tags.filter(isJson).map((t) => ({ label: t.label })) : [];
  const markets = Array.isArray(e.markets) ? e.markets.filter(isJson).map((m) => pick(m, MARKET_FIELDS)) : [];
  return { ...pick(e, EVENT_FIELDS), tags, markets };
}

/** GET /events (a list): each event shaped for a card. */
export function eventList(body: unknown): unknown {
  return Array.isArray(body) ? body.map(eventForList) : body;
}

/** GET /public-search: its events shaped the same way; tags and profiles pass as they are. */
export function searchResults(body: unknown): unknown {
  return isJson(body) && Array.isArray(body.events) ? { ...body, events: body.events.map(eventForList) } : body;
}
