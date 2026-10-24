/**
 * /pitch: five slides for a recorded pitch, with what to say under each (N shows it). The demo stays the product
 * walkthrough; this is why Mitoshi exists and where it goes next. Claims match the README.
 */
export const PITCH = {
  name: "Mitoshi pitch",
  motto: "A new wallet for every trade.",
  slides: [
    {
      id: "watch",
      label: "Start here",
      kicker: "Mitoshi · the pitch",
      title: "Watch the demo first.",
      line: "Then let me show you why we built Mitoshi and where it goes next.",
      cta: { label: "Open the demo", href: "/demo" },
      notes:
        "If you haven't watched the demo, start there: it shows Mitoshi working. This short pitch is about why we built it and where it goes next.",
    },
    {
      id: "problem",
      label: "The problem",
      kicker: "The problem",
      title: "A new wallet doesn't hide you.",
      line: "On Polymarket and Hyperliquid every trade is public. The money that funds a new wallet leads straight back.",
      quotes: [
        { text: "The copy traders literally ruin my trading.", who: "a trader, via @kai_xbt", when: "2026-09-25" },
        {
          text: "I created another wallet to trade in peace and people found it.",
          who: "@DegenCapitalLLC",
          when: "2026-10-01",
        },
      ],
      notes:
        "On Polymarket and Hyperliquid, every trade is public, and tools rank wallets so others can copy them. Traders tell each other to use a new wallet for every trade. But the money that funds it leads straight back, and people find the new wallet anyway.",
    },
    {
      id: "today",
      label: "Built today",
      kicker: "Built today",
      title: "Live at mitoshi.xyz.",
      points: [
        "Polymarket, Polymarket Perps, Hyperliquid and Solana",
        "A real Zcash wallet in your browser",
        "A new wallet per position, funded from the shielded pool through NEAR Intents",
        "Every call about your wallets over Oblivious HTTP",
      ],
      small: "Open source · no account · no Mitoshi fee",
      notes:
        "Mitoshi is live at mitoshi dot x y z. A real Zcash wallet runs in your browser. Every position opens from a brand-new wallet, funded with one standard amount from the shielded pool through NEAR Intents: on Polymarket, Polymarket Perps, Hyperliquid and Solana. Every call about your wallets goes over Oblivious HTTP. No account, and no Mitoshi fee.",
    },
    {
      id: "users",
      label: "Who comes first",
      kicker: "Who comes first",
      title: "Traders who are already being copied.",
      line: "We meet them where they post about it, and put Mitoshi in their hands.",
      groups: [
        { n: "01 / Traders", title: "Polymarket and Hyperliquid regulars", line: "Their wallets are followed today." },
        {
          n: "02 / Zcash holders",
          title: "Shielded ZEC",
          line: "Somewhere to trade without leaving the pool's privacy.",
        },
        { n: "03 / Feedback", title: "Hands-on trials", line: "Fix what real trades show us." },
      ],
      notes:
        "We're starting with the traders who are already being copied: Polymarket and Hyperliquid regulars who post about it. And with Zcash holders who want somewhere to trade without giving up their privacy. The next step is to put Mitoshi in their hands and fix what their real trades show us.",
    },
    {
      id: "next",
      label: "After the hackathon",
      kicker: "After the hackathon",
      title: "Live today. Real traders next.",
      line: "Next: traders using it with their own money, our own light server, and a second operator for one of the two hops, so no one party runs both.",
      closing: "We're building beyond the hackathon.",
      notes:
        "After the hackathon, the first goal is real traders using Mitoshi with their own money. Then we run our own light server, and bring in a second operator for one of the two hops, so no single party runs both. We're building Mitoshi to last beyond this hackathon. Mitoshi: a new wallet for every trade.",
    },
  ],
} as const;

export type PitchSlide = (typeof PITCH.slides)[number];
