import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Diagram } from "@/components/diagram";
import { Hero } from "@/components/home/hero";
import { Section } from "@/components/home/section";
import { Story } from "@/components/home/story";
import { Tile } from "@/components/home/tile";
import { WhoSeesWhat } from "@/components/home/who-sees-what";
import { Logo, LogoCloud } from "@/components/logo-cloud";
import { BRANDS } from "@/lib/brands";
import { DOCS } from "@/lib/site";

/** Proof a judge can check, each with the page that shows how. */
const PROOF = [
  { figure: "1 host", line: "in the browser's resource list on mitoshi.xyz", href: "/docs/privacy/verify" },
  { figure: "14 hosts", line: "on the gateway's API allowlist, nothing else", href: "/docs/privacy/oblivious-http" },
  { figure: "3 sends", line: "proved in the browser, mined on Zcash testnet", href: "/docs/zcash/testnet-proof" },
  { figure: "37 tests", line: "engine 22, rails 8, venues 7, all passing", href: "/docs/build/code-map" },
] as const;

const ZCASH = [
  [
    "librustzcash in your browser",
    "zcash_client_sqlite 0.23 on wasm32-wasip1, in a Web Worker: sync, notes, proofs, sends.",
  ],
  [
    "Ironwood and Orchard",
    "A fresh Orchard-only address for every deposit; change always to Ironwood; Sapling never spent.",
  ],
  [
    "ZIP 318 amounts and timing",
    "Seven standard sizes, random starts, exponential refills, no sync right after a send.",
  ],
  [
    "A light client over OHTTP",
    "Every lightwalletd call is sealed: even a block range would reveal a wallet's birthday.",
  ],
] as const;

export default function Home() {
  return (
    <main className="flex flex-col">
      <Hero />
      <div className="border-fd-border border-b">
        <div className="mx-auto max-w-[78rem] px-4 md:px-8">
          <LogoCloud brands={BRANDS} />
        </div>
      </div>

      <Section
        n="01"
        kicker="One trade, start to finish"
        title="A wallet nobody has seen, for every position."
        line="On a public venue your wallet is your track record. Mitoshi gives each position a brand-new wallet, funded from Zcash's shielded pool through NEAR Intents, so the trail stops at the pool."
      >
        <Story />
        <p className="text-[14px] text-fd-muted-foreground">
          The app, its Zcash wallet and every venue's live data run on mainnet today; the full round trip (fund, trade,
          close, come home) has not run there yet.{" "}
          <Link href="/docs/privacy/verify" className="font-semibold text-fd-primary">
            What is verified →
          </Link>
        </p>
        <Diagram
          name="funding-flow"
          alt="Funding round trip: at a random moment, your shielded ZEC sends one standard amount with a fresh shielded refund address to NEAR Intents, which pays USDC, pUSD or SOL to a fresh wallet in a confidential swap; the wallet opens one position on the venue, closes it, sends the proceeds back through NEAR Intents to a fresh shielded address."
          caption="The money's whole route. Two hops go through NEAR: the funding, always at a standard size, and the trip home, at whatever the wallet holds."
        />
      </Section>

      <Section
        n="02"
        kicker="Every screen"
        title="Four venues, one private balance."
        line="Predictions, US stocks, gold, indices, crypto perps and Solana tokens, all on the venues' own markets, from one shielded balance whose keys never leave your browser."
      >
        <div className="grid gap-4 md:grid-cols-6">
          <Tile
            className="md:col-span-4"
            kind="wide"
            title="Perps terminal"
            line="NVIDIA, gold or BTC with leverage, take-profit and stop-loss. The ticket starts with the amount."
            href="/docs/guide/trade"
            src="/shots/wide/terminal-nvda.webp"
            alt="The NVIDIA perps terminal with one-hour candles and the ticket."
          />
          <Tile
            className="md:col-span-2"
            kind="phone"
            tall
            title="Predict"
            line="Polymarket's events, with live odds and a Yes/No ticket."
            href="/docs/guide/predict"
            src="/shots/phone/event.webp"
            alt="A Polymarket event on a phone."
          />
          <Tile
            className="md:col-span-2"
            kind="phone"
            title="Tokens"
            line="Any Solana token Jupiter routes."
            href="/docs/guide/tokens"
            src="/shots/phone/token-swap.webp"
            alt="A Solana token's buy sheet on a phone."
          />
          <Tile
            className="md:col-span-4"
            kind="wide"
            title="Private wallets"
            line="One per position, funded at a standard size, kept ready if you like, sent home when you're done."
            href="/docs/guide/private-wallets"
            src="/shots/wide/fund.webp"
            alt="The New private wallet sheet with a NEAR Intents quote."
          />
          <Tile
            className="md:col-span-3"
            kind="wide"
            title="Who sees what, in the app"
            line="The Privacy screen lists every party and your wallets as a copy trader finds them."
            href="/docs/privacy"
            src="/shots/wide/privacy.webp"
            alt="The Privacy screen of the app."
          />
          <Tile
            className="md:col-span-3"
            kind="phone"
            title="Deposit and withdraw"
            line="A fresh shielded address every time; a leak meter on every send."
            href="/docs/guide/wallet"
            src="/shots/phone/deposit.webp"
            alt="The Deposit ZEC sheet on a phone with its QR code."
          />
        </div>
      </Section>

      <Section
        n="03"
        kicker="Privacy"
        title="The market sees the trade, not who made it."
        line="Every call about your wallets is sealed with Oblivious HTTP: the relay knows who asks, the gateway knows what is asked, and neither knows both."
      >
        <WhoSeesWhat />
      </Section>

      <Section
        n="04"
        kicker="Built on Zcash"
        title={
          <span className="flex items-center gap-3">
            <Logo name="zcash" className="size-9" /> A real Zcash wallet, in the browser.
          </span>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {ZCASH.map(([title, line]) => (
            <div key={title} className="flex flex-col gap-1.5 rounded-[18px] border border-fd-border bg-fd-card p-5">
              <span className="font-heading font-semibold text-[1.05rem]">{title}</span>
              <span className="text-[14.5px] text-fd-muted-foreground leading-snug">{line}</span>
            </div>
          ))}
        </div>
        <Link href={DOCS.zcash} className="inline-flex items-center gap-1 font-semibold text-fd-primary">
          Built on Zcash <ArrowUpRight className="size-4" />
        </Link>
      </Section>

      <Section
        n="05"
        kicker="How it's built"
        title="A static app, two hops, an allowlist."
        line="No Mitoshi server holds your keys, balances or the map of your wallets."
      >
        <Diagram
          name="system-map"
          alt="System map: the Mitoshi app, its Zcash wallet and per-position keys in the browser send every user call over Oblivious HTTP to a Cloudflare relay that sees the IP, then to a Vercel gateway in Dublin that sees the request, then to allowlisted upstreams: the Zcash light server, NEAR Intents 1Click, and Polymarket, Hyperliquid and Jupiter. Public prices come through the relay."
          caption="Every user call takes the sealed path. Public prices come through the relay's shared feeds."
        />
        <div className="grid gap-px overflow-hidden rounded-[22px] border border-fd-border bg-fd-border sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p) => (
            <Link
              key={p.figure}
              href={p.href}
              className="flex flex-col gap-1 bg-fd-card p-5 transition-colors hover:bg-fd-accent"
            >
              <span className="num font-medium text-[1.6rem] tracking-tight">{p.figure}</span>
              <span className="text-[14px] text-fd-muted-foreground leading-snug">{p.line}</span>
            </Link>
          ))}
        </div>
      </Section>

      <section className="border-fd-border border-t">
        <div className="mx-auto flex max-w-[78rem] flex-col items-start gap-5 px-4 py-16 md:px-8">
          <h2 className="font-heading font-semibold text-[1.9rem] tracking-[-0.025em]">
            Your next trade, from a wallet nobody has seen.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href={DOCS.guide}
              className="inline-flex h-11 items-center rounded-full bg-[var(--mt-accent)] px-5 font-semibold text-[#141210] text-[15px]"
            >
              Read the guide
            </Link>
            <Link
              href={DOCS.build}
              className="inline-flex h-11 items-center rounded-full border border-fd-border px-5 font-semibold text-[15px]"
            >
              See the architecture
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
