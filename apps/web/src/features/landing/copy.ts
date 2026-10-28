/** The landing's words. Every line says only what the product does. */
export const LANDING = {
  nav: {
    how: "How it works",
    venues: "Venues",
    demo: "Demo",
    privacy: "Privacy",
    docs: "Docs",
    open: "Open Mitoshi",
    openShort: "Open app",
  },
  hero: {
    chip: "Live on Zcash mainnet",
    title: ["Trade predictions,", "stocks and crypto"],
    accent: "from shielded ZEC.",
    line: "Every trade on Polymarket, Hyperliquid or Solana gets a brand-new wallet, funded privately through NEAR Intents. The trade is public; who made it isn't.",
    open: "Open Mitoshi",
    how: "How it works",
    small: "No account · no sign-up · your keys stay in this browser",
  },
  judges: {
    strip:
      "ZECATHON judges: the Working demo link in our submission opens a wallet with real money. Trade in 30 seconds.",
    stripShort: "Judges: a funded wallet is waiting",
    stripCta: "How",
    kicker: "ZECATHON · Judge pass",
    title: "Your wallet is funded.",
    line: "Real money on Zcash mainnet, ready to trade. No setup, no sign-up.",
    cta: "Open it from the Working demo link in our submission",
    ctaShort: "Working demo link in our submission",
  },
  problem: {
    kicker: "The problem",
    title: "On a public venue, your wallet is your track record.",
    body: "Win a few trades and copy-trading bots follow the address: they mirror every entry, crowd your exits and front-run your size. Make a new wallet and they find it through the funding. Privacy is the edge, and the venues don't give it.",
    feedTitle: "Copying 0x7a3f…e21c",
    followers: "212 followers",
    feed: [
      ["0x19c4…", "BUY Yes 4,200", "+0.4 s"],
      ["0x88e1…", "BUY Yes 1,500", "+0.9 s"],
      ["0x3fa0…", "BUY Yes 9,800", "+1.2 s"],
      ["0xb21d…", "BUY Yes 600", "+2.0 s"],
    ],
    feedNote: "Illustration of a copy-trading feed",
  },
  how: {
    kicker: "How it works",
    title: "Three steps, and nothing links them.",
    steps: [
      {
        scene: "shielded",
        title: "Deposit shielded ZEC",
        body: "Send from Zodl or any shielded wallet. It lands in a private balance that lives only in this browser, usable at once.",
      },
      {
        scene: "fresh",
        title: "Trade from a brand-new wallet",
        body: "Each position gets its own wallet, funded through NEAR Intents at a standard size, at a random moment. One wallet, one trade.",
      },
      {
        scene: "home",
        title: "Come home shielded",
        body: "Close out and the money swaps back to ZEC, into a fresh shielded address. It rests a few hours, then it's yours to use again.",
      },
    ],
  },
  sees: {
    kicker: "What a copy trader sees",
    title: "A trail of one-trade wallets with no past.",
    publicTitle: "A trader on a public wallet",
    publicRows: [
      ["Trades", "1,284"],
      ["Active since", "March 2025"],
      ["Wallets linked by funding", "6"],
      ["Copy-traders following", "212"],
    ],
    mitoshiTitle: "A trader on Mitoshi",
    mitoshiRows: [
      ["Trades per wallet", "1"],
      ["History before it", "none"],
      ["Funded by", "a NEAR swap, standard size"],
      ["Links between them", "none"],
    ],
    note: "Illustration. Mitoshi shows the real view of each of your wallets, read live from the venue.",
  },
  venues: {
    kicker: "Venues",
    title: "One private balance. Every market.",
    items: [
      {
        venue: "polymarket",
        href: "/predict",
        name: "Polymarket",
        what: "Predictions",
        body: "Buy Yes or No on any event, at market or with a limit, and redeem when it resolves.",
      },
      {
        venue: "polymarket",
        href: "/trade#pm/NVDA-USD",
        name: "Polymarket Perps",
        what: "Stocks · gold · oil",
        body: "NVDA, Tesla, the S&P 500, gold and oil, long or short with leverage.",
      },
      {
        venue: "hyperliquid",
        href: "/trade#BTC",
        name: "Hyperliquid",
        what: "Crypto perps",
        body: "Long or short with leverage, TP and SL, on a live terminal.",
      },
      {
        venue: "solana",
        href: "/tokens",
        name: "Solana",
        what: "Tokens",
        body: "Any token Jupiter routes, from a wallet funded in SOL.",
      },
    ],
    funding: "Each wallet is funded from shielded ZEC in about 8 minutes, and one can wait ready per venue.",
  },
  privacy: {
    kicker: "Private by construction",
    title: "Nobody in the middle sees both ends.",
    path: [
      { who: "Your browser", sees: "everything, encrypted on this device" },
      { who: "Mitoshi relay", sees: "your IP, never what you ask" },
      { who: "Mitoshi gateway", sees: "what is asked, never who" },
      { who: "The venue", sees: "one fresh wallet's trade" },
    ],
    rules: [
      "Standard sizes only, so a funding looks like everyone else's",
      "A random start for every funding, never the moment you tap",
      "Public arrivals rest 2–6 hours before they can fund anything",
      "A fresh shielded refund and payout address for every swap",
      "Every request sealed with Oblivious HTTP",
    ],
    more: "Who sees what",
  },
  built: { kicker: "Built on" },
  faq: {
    title: "Questions",
    items: [
      {
        q: "Who holds my money?",
        a: "You do. Your 24 words and every private wallet's key live only in this browser, encrypted. Mitoshi runs no account and holds no funds.",
      },
      {
        q: "What can Mitoshi see?",
        a: "Nothing it can tie together. The relay sees your IP but not your requests; the gateway sees requests but not who sent them, and writes no logs of its own.",
      },
      {
        q: "What stays public?",
        a: "Each wallet's own trades on its venue, one hop in and one out at a standard size, and NEAR's record of each swap. None of it names you or links your wallets.",
      },
      {
        q: "What does it cost?",
        a: "Mitoshi takes no fee. You pay the venue's own fees and NEAR Intents' 0.2% and spread on each swap, shown before you fund.",
      },
      {
        q: "How fast is a new wallet?",
        a: "About 8 minutes from the moment it starts. Turn on Keep one ready and a funded wallet is always waiting.",
      },
    ],
  },
  final: { title: "Your next trade, from a wallet nobody has seen.", open: "Open Mitoshi" },
  demo: {
    title: "Demo",
    pending: "Recording soon",
    watch: "Watch on YouTube",
    line: "Until it's up, try it live.",
    stillAlt: "Mitoshi on a phone: a Polymarket event, the NVIDIA perps terminal and a Long order sheet",
    coverAlt: "Play the Mitoshi demo",
    tries: [
      { label: "Long a stock", href: "/trade#pm/NVDA-USD" },
      { label: "Back an outcome", href: "/predict" },
      { label: "What the public sees", href: "/privacy" },
    ],
  },
  footer: {
    built: "Built for ZECATHON 2026",
    repo: "Source",
    demo: "Demo",
    pitch: "Pitch",
    docs: "Docs",
    privacy: "Privacy",
    status: "Status",
  },
} as const;

export const REPO_URL = "https://github.com/mitoshi-xyz/mitoshi";

/** The demo recording on YouTube, once it exists. /demo links out to it: nothing from YouTube loads on this site. */
export const DEMO_VIDEO_URL: string | null = null;
