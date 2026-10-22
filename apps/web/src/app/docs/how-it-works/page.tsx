import { Code, H2, H3, List, Note, P, Steps, Title } from "@/features/docs/prose";

export default function HowItWorks() {
  return (
    <>
      <Title kicker="How it works">From shielded ZEC to a fresh wallet and back</Title>
      <H2>The private balance</H2>
      <P>
        The wallet is Zcash's own <Code>zcash_client_sqlite</Code> compiled to WebAssembly and run in a Web Worker. It
        holds Orchard and Ironwood (NU6.3) shielded notes, scans the chain privately and makes its proofs in the
        browser. Its file is encrypted with AES-GCM under a key that cannot leave the browser, and saved in IndexedDB.
      </P>
      <List
        items={[
          "Every deposit address is fresh. A deposit from a shielded wallet is usable once it confirms.",
          "Money that arrives from a public (transparent) address, including payouts from NEAR, rests 2–6 hours before it can fund anything, so its arrival can't be matched to your next trade.",
          "The wallet syncs every 30 seconds through Oblivious HTTP; even block ranges are sealed, because where a scan starts reveals a birthday.",
        ]}
      />
      <H2>Private wallets</H2>
      <P>
        Each private wallet has its own key, derived from your 24 words on Mitoshi's own hardened path:{" "}
        <Code>m/44'/coin'/6874'/venue'/index'</Code> (coin 60 for Polymarket and Hyperliquid, 501 for Solana). No two
        wallets share a key, and none is a normal wallet path.
      </P>
      <H3>Funding</H3>
      <Steps
        items={[
          {
            title: "A standard size",
            body: "0.01, 0.02, 0.05, 0.1, 0.2, 0.5 or 1 ZEC, so the one public hop looks like thousands of others.",
          },
          {
            title: "A random start",
            body: "The funding begins 20 seconds to 3 minutes after you ask, never at the tap.",
          },
          {
            title: "One shielded payment",
            body: "Exactly that size goes to NEAR's deposit address for a signed 1Click quote. The change stays shielded; there is no memo.",
          },
          {
            title: "NEAR swaps and delivers",
            body: "USDC on Hyperliquid, SOL on Solana, or USDC to the wallet's Polymarket bridge address (credited as pUSD). About 8 minutes.",
          },
        ]}
      />
      <Note>
        Every 1Click quote is checked against NEAR's published signing key and against what was asked (assets, amount,
        recipient, refund address) before its deposit address is used, so no server in between could swap the address.
        Refunds always go to a fresh shielded address.
      </Note>
      <H3>Keep one ready</H3>
      <P>
        While Mitoshi is open, it can hold a funded wallet per venue at a size you pick, so a trade never waits for a
        funding.
      </P>
      <H3>Coming home</H3>
      <P>
        Sending a wallet home closes what it holds (sells, redeems, closes perps), takes a signed 1Click quote to a
        fresh shielded address and sends the money to NEAR's deposit address. On Polymarket the pUSD goes through
        Polymarket's bridge, which pays NEAR in USDC. The ZEC arrives in about 2–3 minutes and rests 2–6 hours. Under a
        dollar or so is left as dust rather than merged anywhere.
      </P>
      <H2>Recovery</H2>
      <P>
        Your 24 words restore the balance and, with a slow private scan, find the private wallets they made. A backup
        file restores both at once. See Backup and recovery.
      </P>
    </>
  );
}
