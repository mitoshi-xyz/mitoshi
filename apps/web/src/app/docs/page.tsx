import Link from "next/link";
import { H2, Lead, List, P, Steps, Title } from "@/features/docs/prose";

export default function DocsOverview() {
  return (
    <>
      <Title kicker="Mitoshi docs">Trade anywhere, and nobody can follow you</Title>
      <Lead>
        Mitoshi is a private trading app. You hold shielded ZEC in your browser, and every position you open on
        Polymarket, Hyperliquid or Solana comes from a wallet that has never existed before. When you close, the money
        comes back to shielded ZEC.
      </Lead>
      <H2>Why it exists</H2>
      <P>
        On public venues a wallet is a track record. Traders who win get copied, front-run and followed, and a new
        wallet is found again through its funding. Mitoshi breaks the trail: each position lives in its own wallet,
        funded from Zcash's shielded pool through NEAR Intents, so a copy trader finds one-trade wallets with no past
        and no link to each other or to you.
      </P>
      <H2>The journey</H2>
      <Steps
        items={[
          {
            title: "Create or restore a wallet",
            body: "24 words, made and kept in this browser. Nothing is sent anywhere.",
          },
          { title: "Deposit shielded ZEC", body: "From Zodl or any shielded wallet; usable as soon as it confirms." },
          {
            title: "Open a position",
            body: "Mitoshi funds a brand-new wallet on the venue at a standard size, at a random moment, in about 8 minutes (or instantly, from a wallet kept ready).",
          },
          { title: "Trade", body: "Buy an outcome, open a perp, swap a token, each signed by that wallet's own key." },
          { title: "Come home", body: "Close out; the money swaps back to ZEC into a fresh shielded address." },
        ]}
      />
      <H2>What makes it different</H2>
      <List
        items={[
          "Self-custody with no account: the keys, the balance and the list of your wallets never leave the browser.",
          "One fresh wallet per position, on three venues, from one private balance.",
          "Every request is sealed with Oblivious HTTP, so no server sees both who you are and what you ask.",
          <>
            A leak meter on every send, and a <Link href="/docs/privacy">threat model</Link> that says plainly what
            stays public.
          </>,
        ]}
      />
    </>
  );
}
