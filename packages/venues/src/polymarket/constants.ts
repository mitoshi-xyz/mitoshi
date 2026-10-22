/** Polymarket public APIs (docs.polymarket.com): Gamma for events, the CLOB for prices and books. */
export const GAMMA_API = "https://gamma-api.polymarket.com";
export const CLOB_API = "https://clob.polymarket.com";

/** Browse categories, as Gamma tag slugs ("trending" means no tag, sorted by 24h volume). */
export const CATEGORIES = [
  { slug: "trending", label: "Trending" },
  { slug: "politics", label: "Politics" },
  { slug: "sports", label: "Sports" },
  { slug: "crypto", label: "Crypto" },
  { slug: "finance", label: "Finance" },
  { slug: "geopolitics", label: "Geopolitics" },
  { slug: "tech", label: "Tech" },
  { slug: "culture", label: "Culture" },
  { slug: "world", label: "World" },
  { slug: "economy", label: "Economy" },
] as const;

export type Category = (typeof CATEGORIES)[number]["slug"];

/** Probability-chart ranges and the point spacing (minutes) asked of the CLOB. */
export const HISTORY = {
  "1h": { interval: "1h", fidelity: 1 },
  "6h": { interval: "6h", fidelity: 5 },
  "1d": { interval: "1d", fidelity: 10 },
  "1w": { interval: "1w", fidelity: 60 },
  "1m": { interval: "1m", fidelity: 180 },
  all: { interval: "max", fidelity: 720 },
} as const;

export type HistoryRange = keyof typeof HISTORY;

/** Events per page when browsing. */
export const PAGE_SIZE = 24;

/** Polymarket's minimum order size, in shares (markets report their own; this is the fallback). */
export const DEFAULT_MIN_SHARES = 5;
