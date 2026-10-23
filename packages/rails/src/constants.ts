/** NEAR Intents 1Click (docs.near-intents.org). Reached only over OHTTP through the gateway. */
export const ONECLICK_API = "https://1click.chaindefuser.com/v0";

/**
 * 1Click's quote-signing key, as published in its TypeScript SDK (`ONE_CLICK_MANAGER_PUB_KEY`,
 * @defuse-protocol/one-click-sdk-typescript 0.1.26). Every quote is checked against it before its
 * deposit address is used, so neither our relay nor gateway could swap in an address.
 */
export const ONECLICK_SIGNING_KEY = "ed25519:reYaWhvwu8Jzo3WUM3zhn6VrhuMEF4eADL17qtRVifc";

/** 1Click asset ids (GET /v0/tokens, 2026-10-22). */
export const ASSETS = {
  zec: { id: "nep141:zec.omft.near", decimals: 8, symbol: "ZEC", chain: "zec" },
  hypercoreUsdc: {
    id: "1cs_v1:hypercore:hip1:0x6d1e7cde53ba9467b783cb7c530ce054",
    decimals: 8,
    symbol: "USDC",
    chain: "hypercore",
  },
  polygonUsdc: {
    id: "nep245:v2_1.omni.hot.tg:137_qiStmoQJDQPTebaPjgx5VBxZv6L",
    decimals: 6,
    symbol: "USDC",
    chain: "pol",
  },
  // Polymarket's bridge takes USDC from any of these at a wallet's EVM bridge address (USDC → pUSD).
  arbitrumUsdc: {
    id: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near",
    decimals: 6,
    symbol: "USDC",
    chain: "arb",
  },
  baseUsdc: {
    id: "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near",
    decimals: 6,
    symbol: "USDC",
    chain: "base",
  },
  sol: { id: "nep141:sol.omft.near", decimals: 9, symbol: "SOL", chain: "sol" },
} as const;

export type AssetKey = keyof typeof ASSETS;

/** Slippage allowed on a swap, in basis points. */
export const SLIPPAGE_BPS = 100;

/** How long a deposit address stays live. ZEC deposits need confirmations, so allow two hours. */
export const DEADLINE_MS = 2 * 60 * 60 * 1000;
