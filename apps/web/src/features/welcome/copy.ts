/**
 * The first-run story: one picture, one headline and one sentence a scene, then three actions
 * (value first, sign last). Each line says only what the product does.
 */
export const WELCOME = {
  scenes: [
    {
      key: "shielded",
      title: "Your money, shielded.",
      body: "Shielded ZEC that lives only in this browser. Nobody sees the amount, Mitoshi included.",
    },
    {
      key: "fresh",
      title: "A new wallet for every trade.",
      body: "Each position opens from a wallet that has never existed before.",
    },
    {
      key: "venues",
      title: "Polymarket, Hyperliquid, Solana.",
      body: "Predictions, perps and tokens, filled at each venue's own prices.",
    },
    {
      key: "public",
      title: "Copy traders find nothing.",
      body: "One wallet, one trade, no history, and no link to your other wallets.",
    },
    {
      key: "home",
      title: "Then it comes home.",
      body: "Close out and the money returns to shielded ZEC in minutes.",
    },
  ],
  create: "Create a private wallet",
  restore: "I have a recovery phrase",
  look: "Look around first",
  scene: (n: number, of: number) => `Scene ${n} of ${of}`,
} as const;

export type SceneKey = (typeof WELCOME.scenes)[number]["key"];
