import Link from "next/link";

/*
 * The judged story, the same one the README leads with: one trade, start to finish, each step pointing at the page that
 * explains it. Numbers are from the captures taken on mitoshi.xyz on 2026-10-23.
 */

const STEPS = [
  {
    title: "A private balance",
    body: "24 words, made and kept in your browser. Deposit shielded ZEC from Zodl to a fresh address.",
    href: "/docs/guide/getting-started",
  },
  {
    title: "Pick a market",
    body: "NVIDIA on Polymarket Perps: $25 at 5× is a $125.00 position, fee $0.05.",
    href: "/docs/guide/trade",
  },
  {
    title: "A wallet nobody has seen",
    body: "A new key for this position, funded with one standard amount at a random moment: a dry quote for 0.05 ZEC came back at ≈ 61.43 USDC.",
    href: "/docs/guide/private-wallets",
  },
  {
    title: "Trade",
    body: "The order goes to the venue's real book from that wallet, and only that wallet.",
    href: "/docs/venues",
  },
  {
    title: "What a copy trader would see",
    body: "One funding from a NEAR swap, one position, no history, no link to your other wallets.",
    href: "/docs/privacy",
  },
  {
    title: "Come home",
    body: "Close, then send home: the proceeds swap back to ZEC at a fresh shielded address.",
    href: "/docs/venues/near-intents",
  },
] as const;

export function Story() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[22px] border border-fd-border bg-fd-border sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="bg-fd-card">
          <Link href={s.href} className="group flex h-full flex-col gap-2 p-6 transition-colors hover:bg-fd-accent">
            <span className="font-mono text-[12px] text-[var(--mt-accent-text)]">{String(i + 1).padStart(2, "0")}</span>
            <span className="font-heading font-semibold text-[1.15rem] tracking-[-0.015em]">{s.title}</span>
            <span className="text-[14.5px] text-fd-muted-foreground leading-snug">{s.body}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
