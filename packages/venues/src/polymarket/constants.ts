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

/**
 * Polymarket's on-chain layout (Polygon, chain 137), as the official SDK's production
 * environment names it (@polymarket/client 0.12.0): the Deposit Wallet factory and beacon, and
 * pUSD, the collateral every market settles in.
 */
export const POLYGON_CHAIN_ID = 137;
export const DEPOSIT_WALLET_FACTORY = "0x00000000000Fb5C9ADea0298D729A0CB3823Cc07";
export const DEPOSIT_WALLET_BEACON = "0x7A18EDfe055488A3128f01F563e5B479D92ffc3a";
export const PUSD = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
export const PUSD_DECIMALS = 6;
/** Native USDC on Polygon: what NEAR's 1Click delivers and what the bridge pays out. */
export const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
export const BRIDGE_API = "https://bridge.polymarket.com";
export const DATA_API = "https://data-api.polymarket.com";
export const RELAYER_API = "https://relayer-v2.polymarket.com";

/**
 * Solady LibClone's ERC-1967 beacon proxy with immutable args (initCodeHashERC1967BeaconProxy):
 * the creation-code prefix (whose last bytes carry the args length) and the three runtime words
 * that follow the beacon address.
 */
export const BEACON_PROXY_PREFIX = 0x6100523d8160233d3973n;
export const BEACON_PROXY_LENGTH_SHIFT = 56n;
export const BEACON_PROXY_PREFIX_BYTES = 10;
export const BEACON_PROXY_CODE = [
  "0x60195155f3363d3d373d3d363d602036600436635c60da",
  "0x1b60e01b36527fa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6c",
  "0xb3582b35133d50545afa5036515af43d6000803e604d573d6000fd5b3d6000f3",
] as const;

/** Polygon reads (the official SDK's default RPC, through the gateway). */
export const POLYGON_RPC = "https://polygon.drpc.org";
/** ERC-20 balanceOf(address) selector, and an address as one 32-byte word (hex chars). */
export const BALANCE_OF = "0x70a08231";
export const ADDRESS_WORD_CHARS = 64;
/** Rows asked of the data API per page. */
export const POSITIONS_PAGE = 100;
export const ACTIVITY_PAGE = 500;

/** USDC on the chains NEAR can deliver to Polymarket's bridge, for when one route is unavailable. */
export const BRIDGE_SOURCES = {
  polygonUsdc: { chainId: 137, usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", name: "Polygon" },
  arbitrumUsdc: { chainId: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", name: "Arbitrum" },
  baseUsdc: { chainId: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "Base" },
} as const;
