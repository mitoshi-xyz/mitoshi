/** The docs site's own constants: where things live, and the product's lines, word for word. */

export const SITE = {
  name: "Mitoshi",
  title: "Mitoshi docs",
  /** 見通し: outlook, the view ahead. */
  meaning: "outlook",
  url: "https://docs.mitoshi.xyz",
  app: "https://mitoshi.xyz",
  repo: "https://github.com/mitoshi-xyz/mitoshi",
  headline: "Trade predictions, stocks and crypto from shielded ZEC.",
  subline:
    "On Polymarket, Hyperliquid and Solana, each position opens from a brand-new wallet funded through NEAR Intents: copy traders find one trade and no history.",
  motto: "A new wallet for every trade.",
  description:
    "Trade predictions, stocks and crypto from shielded ZEC: on Polymarket, Hyperliquid and Solana, each position opens from a brand-new wallet funded through NEAR Intents.",
} as const;

/** The docs' sections (the top tabs) and where each starts. */
export const DOCS = {
  base: "/docs",
  guide: "/docs/guide",
  venues: "/docs/venues",
  privacy: "/docs/privacy",
  zcash: "/docs/zcash",
  build: "/docs/build/architecture",
} as const;

/** Link previews: one size for every page. */
export const OG = { width: 1200, height: 630 } as const;
