import { H2, List, P, Title } from "@/features/docs/prose";

export default function VenuesDocs() {
  return (
    <>
      <Title kicker="Venues">Predictions, perps, stocks and tokens</Title>
      <H2>Polymarket</H2>
      <P>
        Each Polymarket wallet is a Deposit Wallet for a fresh signer key, run by Polymarket's official TypeScript SDK
        in its own worker (every call sealed with Oblivious HTTP). Deployment and approvals are gasless through
        Polymarket's relayer; the Builder secret that authorizes them stays on Mitoshi's gateway, which signs only
        Deposit Wallet requests.
      </P>
      <List
        items={[
          "Funding: NEAR delivers USDC to the wallet's Polymarket bridge address, which credits pUSD. If NEAR has no route to Polygon at that moment, it delivers on Arbitrum or Base instead; the bridge takes either.",
          "Trading: buy or sell any outcome at market (fill-and-kill, with a price guard) or with a limit; cancel open orders; redeem winning shares after resolution.",
          "One position per wallet: buying more or selling stays on the wallet that holds it; a new market gets a fresh wallet.",
          "Home: orders cancelled, resolved shares redeemed, the rest sold, then the pUSD goes through a bridge withdrawal to NEAR and back to ZEC.",
        ]}
      />
      <H2>Polymarket Perps</H2>
      <P>
        Perpetuals on US stocks, indices, gold, oil and crypto, margined in pUSD, from the same fresh Polymarket
        wallets. The wallet's own key owns the Perps account and authorizes a proxy key that signs each order; every
        request is a signed command over Polymarket's REST API, so it goes through Oblivious HTTP like everything else.
      </P>
      <List
        items={[
          "Funding: the wallet's pUSD moves from its Deposit Wallet into Perps (gasless, at least 10 pUSD); that first deposit opens the Perps account.",
          "Trading: long or short at market (an IOC limit through the mark) or with a limit, leverage, and take-profit and stop-loss exits.",
          "Home: orders cancelled, positions closed, the withdrawable pUSD withdrawn back to the Deposit Wallet by the owner's signature, then the Polymarket route home.",
        ]}
      />
      <H2>Hyperliquid</H2>
      <List
        items={[
          "Funding: NEAR delivers USDC on HyperCore to the wallet; Mitoshi moves it from spot to perps when needed. A new Hyperliquid account pays Hyperliquid's one-time 1 USDC activation fee.",
          "Trading: the live terminal, long or short with leverage, take-profit and stop-loss, and close, through Hyperliquid's API with the wallet's own key.",
          "Home: positions closed, USDC gathered in spot and sent to NEAR's deposit address.",
        ]}
      />
      <H2>Solana</H2>
      <List
        items={[
          "Funding: NEAR delivers SOL, which also pays the wallet's fees.",
          "Trading: any token Jupiter routes, through Jupiter Ultra, signed by the wallet's own key.",
          "Home: every token sold back to SOL, then one transfer to NEAR's deposit address.",
        ]}
      />
      <H2>Public data</H2>
      <P>
        Market lists, books, charts and prices come from each venue's public API through the relay too, and live prices
        from one shared stream the relay keeps open, so browsing never reaches a venue directly.
      </P>
    </>
  );
}
