import Link from "next/link";
import { DOCS } from "@/lib/site";

/** The privacy model in four rows; the full table is on the Privacy tab. */
const ROWS = [
  ["The venue", "One fresh wallet's own trades, sent from Ireland", "Your other wallets, your balance, your IP"],
  [
    "A copy trader",
    "A wallet with one funding from a NEAR swap and one trade",
    "Whose it is, or any other wallet of yours",
  ],
  ["Relay · Cloudflare", "Your IP, and which public markets you look at", "What you ask about your wallets"],
  ["Gateway · Dublin", "One decrypted request, from the relay", "Your IP, or which requests are yours"],
] as const;

export function WhoSeesWhat() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-fd-border bg-fd-card">
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-fd-border border-b px-5 py-3 font-mono text-[11px] text-fd-muted-foreground uppercase tracking-[0.12em] max-sm:hidden">
        <span>Party</span>
        <span>Sees</span>
        <span>Never sees</span>
      </div>
      {ROWS.map(([party, sees, never]) => (
        <div
          key={party}
          className="grid gap-1 border-fd-border border-b px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-4"
        >
          <span className="font-heading font-semibold text-[15px]">{party}</span>
          <span className="text-[14px]">{sees}</span>
          <span className="text-[14px] text-fd-muted-foreground">
            <span className="font-mono text-[11px] uppercase sm:hidden">never · </span>
            {never}
          </span>
        </div>
      ))}
      <Link
        href={`${DOCS.privacy}#who-sees-what`}
        className="block border-fd-border border-t px-5 py-3 font-semibold text-[14px] text-fd-primary hover:bg-fd-accent"
      >
        Every party, what it sees and what stays public →
      </Link>
    </div>
  );
}
