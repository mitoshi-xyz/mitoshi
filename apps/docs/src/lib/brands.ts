import type { Brand } from "@/components/logo-cloud";

/**
 * The networks and venues Mitoshi really works with (services/gateway/src/constants.ts allowlist, packages/venues,
 * packages/rails). Marks are the app's vendored copies (apps/web/public/marks), see THIRD_PARTY_NOTICES.md.
 */
export const BRANDS: Brand[] = [
  { name: "Zcash", logo: "zcash" },
  { name: "NEAR Intents", logo: "near" },
  { name: "Polymarket", logo: "polymarket" },
  { name: "Polymarket Perps", logo: "polymarket" },
  { name: "Hyperliquid", logo: "hyperliquid" },
  { name: "Solana", logo: "solana" },
  { name: "Jupiter", logo: "jupiter" },
  { name: "Polygon", logo: "polygon" },
];
