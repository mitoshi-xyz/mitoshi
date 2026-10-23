import { H2, List, Note, P, Table, Title } from "@/features/docs/prose";

export default function PrivacyDocs() {
  return (
    <>
      <Title kicker="Privacy and threat model">Who sees what, and what stays public</Title>
      <P>
        Mitoshi's promise is narrow and checkable: nobody can link two of your trading wallets, or any of them to you or
        your ZEC. This page lists every party that touches a request, what it can see, and what is public on purpose.
      </P>
      <H2>Who sees what</H2>
      <Table
        head={["Party", "Sees", "Never sees"]}
        rows={[
          ["Your browser", "Everything: words, balance, which wallets are yours", "Sends any of it anywhere"],
          [
            "Mitoshi relay (Cloudflare)",
            "Your IP, and that a sealed request passed",
            "What you asked, or which wallet it was about",
          ],
          [
            "Mitoshi gateway (Vercel, Ireland)",
            "One request's content, like an address's balance",
            "Who sent it: no IP, no cookies, no account. It writes no logs; Vercel's request log sees only the relay's address",
          ],
          [
            "Venues (Polymarket, Hyperliquid, Jupiter)",
            "One fresh wallet's trades, from the gateway's address",
            "Your other wallets, your IP, your ZEC",
          ],
          [
            "NEAR Intents 1Click",
            "Each swap: a standard ZEC amount in, a fresh wallet out",
            "Which swaps are yours; refunds go to fresh shielded addresses",
          ],
          [
            "The Zcash chain",
            "A shielded transaction, and the one hop to NEAR's deposit address",
            "Your balance, your addresses, amounts in the pool",
          ],
        ]}
      />
      <H2>Oblivious HTTP</H2>
      <P>
        Every request the app makes (wallet sync, quotes, orders, balances, even public market data) is encrypted to the
        gateway's key (RFC 9458, X25519 and AES-128-GCM, a fresh key per request) and posted to the relay. The relay
        knows your IP but can't read the request; the gateway reads it but only sees the relay. The gateway's key is
        pinned in the app, and it calls only an allowlist of hosts and paths. Pictures come through the same relay's
        image proxy, so no image host sees your browser.
      </P>
      <H2>Rules that keep wallets apart</H2>
      <List
        items={[
          "One wallet per position, each on its own hardened key path.",
          "Fundings only at standard sizes (0.01 to 1 ZEC), started at a random moment 20 seconds to 3 minutes after you ask.",
          "A keep-ready replacement starts after a random delay, 90 minutes on average and at most 12 hours, never right after the trade that used the last one. A funding that came due while the app was closed gets a new random start instead of going out when the app opens.",
          "Value from a public address rests 2–6 hours (sampled per note) before it can fund anything.",
          "Every swap gets a fresh shielded refund address, and every trip home a fresh shielded payout address.",
          "No memos, and the standard transaction shape.",
          "No builder code on orders. Portfolio reads for different wallets run on independent random schedules (what remains is under What stays public, below).",
          "The recovery scan asks about one address at a time, seconds apart.",
        ]}
      />
      <H2>The leak meter</H2>
      <P>
        Every send runs through the leak meter. A funding must be a standard size and must not spend resting money; red
        stops it. A withdrawal to a public address is checked against what came home in the last 48 hours: an exact
        match is red, one within 2% is amber, and sending within 2 hours of a payout is amber. A withdrawal to a
        shielded address is always clear. On withdrawals red warns rather than blocks, because sending to your own
        exchange is your choice.
      </P>
      <H2>What stays public</H2>
      <List
        items={[
          "Each wallet's own trades on its venue.",
          "One hop in and one hop out per wallet, at a standard size, through NEAR's deposit addresses.",
          "NEAR Intents' record of each swap, which pairs its deposit with its payout. NEAR's confidential mode, in which deposits and payouts can't be matched, is used whenever the gateway holds a NEAR partner key.",
          "On Polymarket, wallet creation is gasless through Polymarket's relayer and attributed to Mitoshi's builder profile: Polymarket knows a wallet was made by a Mitoshi user, not which one.",
          "Reading your wallets: while Portfolio or a terminal is open, the venues and the gateway see their balances asked about in the same stretch of time. Each wallet is read on its own random schedule, through one gateway address shared by every user, and the gateway keeps no logs, but someone watching many sessions could still notice two addresses that are always asked about in the same minutes. Keep fewer wallets open at once if that matters to you.",
        ]}
      />
      <Note tone="warn">
        Opening a block explorer for one of your wallets from your own browser shows that site your IP next to the
        wallet. Mitoshi's copy-trader view reads the same public data through the relay instead; use Tor or a VPN for
        explorers.
      </Note>
    </>
  );
}
