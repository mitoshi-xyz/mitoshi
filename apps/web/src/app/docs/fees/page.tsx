import { H2, List, Note, P, Table, Title } from "@/features/docs/prose";

export default function FeesDocs() {
  return (
    <>
      <Title kicker="Fees and timing">What it costs, and how long it takes</Title>
      <H2>Fees</H2>
      <Table
        head={["What", "Who charges it", "How much"]}
        rows={[
          ["Trading", "Mitoshi", "Nothing. No fee and no builder code on any order"],
          ["Venue fees", "Polymarket, Hyperliquid, Jupiter", "Each venue's own trading fees, as on the venue"],
          ["Funding swap", "NEAR Intents solvers", "The swap spread, shown in the price before you fund"],
          ["Zcash network fee", "Zcash miners", "The standard ZIP 317 fee, about 0.0001–0.00015 ZEC per payment"],
          [
            "Polymarket bridge",
            "Polymarket's bridge provider",
            "Shown before you fund (about $0.02 on $60, measured 2026-10-22)",
          ],
          ["Hyperliquid activation", "Hyperliquid", "1 USDC once, for a brand-new account"],
          ["Trip home in ZEC", "NEAR Intents", "A fixed 0.00032 ZEC to pay ZEC out, plus the swap spread"],
        ]}
      />
      <Note>
        Mitoshi's own funding fee is built in (0.2% through NEAR's app fees) but switched off: it takes effect only once
        a fee recipient is named, and the Fund screen always shows the fee line before you confirm.
      </Note>
      <H2>Timing</H2>
      <Table
        head={["Step", "Typical time", "Source"]}
        rows={[
          ["A new wallet starts funding", "20 s to 3 min after you ask, at random", "Mitoshi's scheduler"],
          ["Funding (ZEC in, venue asset out)", "About 7.5 minutes", "1Click time estimates, 452–465 s (2026-10-22)"],
          ["Polymarket credit (USDC to pUSD)", "About 30 seconds", "Polymarket bridge quote, 27 s"],
          ["Trip home (venue asset to ZEC)", "About 2.5 minutes", "1Click time estimates, 140–150 s"],
          ["Resting after a public arrival", "2 to 6 hours, sampled per note", "Mitoshi's rest rules"],
          ["Private proof in the browser", "About 15–20 seconds", "Measured on testnet, single-threaded"],
        ]}
      />
      <H2>Sizes</H2>
      <P>Fundings are always one of these standard sizes, so the public hop blends in:</P>
      <List items={["0.01, 0.02, 0.05 ZEC", "0.1, 0.2, 0.5 ZEC", "1 ZEC"]} />
    </>
  );
}
