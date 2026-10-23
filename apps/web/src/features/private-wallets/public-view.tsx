"use client";

import { isCanonical, type PrivateWallet, type Registry, walletPath, ZAT_PER_ZEC } from "@mitoshi/engine";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Eye, Minus, X } from "lucide-react";
import { useRef, useState } from "react";
import { cx, Drawer, Skeleton } from "@/kit";
import { hlMarket } from "../hyperliquid/hl";
import { VenueMark } from "../marks/mark";
import { pmMarket } from "../polymarket/pm";
import { solMarket } from "../solana/sol";
import { useRegistry } from "./registry-store";
import { VENUES } from "./venues";

const FOOTPRINT_STALE_MS = 30_000;
const ZEC_DIGITS = 8;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

/** The public record of one address, read from the venue itself (over OHTTP). */
function useFootprint(w: PrivateWallet) {
  return useQuery({
    queryKey: ["footprint", w.venue, w.address],
    staleTime: FOOTPRINT_STALE_MS,
    queryFn: () =>
      w.venue === "hyperliquid"
        ? hlMarket.footprint(w.address as `0x${string}`)
        : w.venue === "polymarket"
          ? pmMarket.footprint(w.address)
          : solMarket.footprint(w.address),
  });
}

interface LinkCheck {
  /** Null when this device can't tell, like a recovered wallet's funding size: unknown is not a link. */
  ok: boolean | null;
  text: string;
}

/** Whether a wallet's checks found something public that ties it to another of yours. */
export const linkFound = (checks: LinkCheck[]) => checks.some((c) => c.ok === false);

/**
 * Whether anything public ties this wallet to another of yours, checked against everything this
 * device knows: addresses, swap deposit addresses, refund and payout addresses.
 */
export function linkChecks(w: PrivateWallet, r: Registry): LinkCheck[] {
  const others = r.wallets.filter((x) => x.id !== w.id);
  const otherAddresses = new Set(others.map((x) => x.address.toLowerCase()));
  const otherSwapEnds = new Set(
    others
      .flatMap((x) => x.swaps.flatMap((s) => [s.depositAddress, s.refundTo, s.recipient]))
      .map((a) => a.toLowerCase()),
  );
  const mine = w.swaps.flatMap((s) => [s.depositAddress, s.refundTo, s.recipient]).map((a) => a.toLowerCase());
  return [
    { ok: true, text: `Its own key, on its own path (${walletPath(w.venue, w.index)})` },
    {
      ok: !otherAddresses.has(w.address.toLowerCase()) && !mine.some((a) => otherAddresses.has(a)),
      text: "No transfer to or from any of your other wallets",
    },
    {
      ok: !mine.some((a) => otherSwapEnds.has(a)),
      text: "Its swaps share no deposit, refund or payout address with any other wallet",
    },
    w.recovered
      ? { ok: null, text: "Found again from your words, so this device has no record of its funding swap" }
      : {
          ok: isCanonical(w.sizeZat),
          text: `Funded by one NEAR Intents swap of ${zec(w.sizeZat)} ZEC, a standard size many people use`,
        },
  ];
}

function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "up" | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-ink-2">{k}</dt>
      <dd className={cx("num text-right", tone === "up" && "text-up")}>{v}</dd>
    </div>
  );
}

const count = (n: number, capped = false) => `${n.toLocaleString()}${capped ? "+" : ""}`;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const ago = (ms: number) => {
  const minutes = Math.round((Date.now() - ms) / MS_PER_MINUTE);
  return minutes < MINUTES_PER_HOUR ? `${Math.max(1, minutes)} min ago` : new Date(ms).toLocaleString();
};

/** The copy-trader's view: what anyone looking at this wallet on the venue can see, and what they can't. */
export function PublicView({ wallet, onClose }: { wallet: PrivateWallet | null; onClose: () => void }) {
  // Keep the last wallet while the drawer slides away.
  const last = useRef<PrivateWallet | null>(null);
  if (wallet) last.current = wallet;
  const shown = wallet ?? last.current;
  return (
    <Drawer open={Boolean(wallet)} onClose={onClose} title="What the public sees" wide>
      {shown ? <PublicBody w={shown} /> : null}
    </Drawer>
  );
}

function PublicBody({ w }: { w: PrivateWallet }) {
  const registry = useRegistry();
  const [copied, setCopied] = useState(false);
  const footprint = useFootprint(w);
  const venue = VENUES[w.venue];
  const checks = linkChecks(w, registry);
  const linked = linkFound(checks);
  const f = footprint.data;
  return (
    <>
      <p className="-mt-2 text-[14px] text-ink-2">
        This is the wallet as a copy trader finds it on {venue.name}: read live from {venue.name}'s own public data.
      </p>
      <div className="flex flex-col gap-1 rounded-xl border border-hairline bg-bg p-4">
        <div className="flex items-center gap-3">
          <VenueMark venue={w.venue} size={32} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="type-label text-muted">Public profile on {venue.name}</span>
            <span className="num truncate text-[13px]" title={w.address}>
              {w.address}
            </span>
          </div>
          <button
            type="button"
            aria-label="Copy the address"
            onClick={() => {
              void navigator.clipboard.writeText(w.address);
              setCopied(true);
            }}
            className="rounded-md p-2 text-ink-2 hover:bg-surface-1 hover:text-ink"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
        {footprint.isPending ? (
          <div className="flex flex-col gap-2 pt-3">
            <Skeleton className="h-5" label={`Reading ${venue.name}'s public record`} />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        ) : footprint.isError ? (
          <p className="pt-3 text-[13px] text-warning">
            {venue.name} didn't answer just now.{" "}
            <button type="button" className="text-accent hover:underline" onClick={() => void footprint.refetch()}>
              Try again
            </button>
          </p>
        ) : (
          <dl className="divide-y divide-hairline pt-2 text-[13px]">
            <Row k="First seen" v={f?.firstSeen ? ago(f.firstSeen) : "never: nothing public yet"} />
            <Row
              k={w.venue === "hyperliquid" ? "Orders filled" : "Transactions"}
              v={count(f?.activity ?? 0, f?.activityCapped)}
            />
            {f?.transfers !== null && f?.transfers !== undefined ? (
              <Row k="Deposits and withdrawals" v={count(f.transfers, f.transfersCapped)} />
            ) : null}
            {f?.openPositions !== null && f?.openPositions !== undefined ? (
              <Row k="Open positions" v={f.openPositions} />
            ) : null}
            <Row k="History before this wallet" v="none" tone="up" />
            <Row k="Links to your other wallets" v={linked ? "found one" : "none"} tone={linked ? undefined : "up"} />
          </dl>
        )}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="type-title">Why it can't be tied to you</h3>
        <ul className="flex flex-col gap-2 text-[13px]">
          {checks.map((c) => (
            <li key={c.text} className="flex gap-2.5">
              <span
                className={cx(
                  "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full",
                  c.ok === null ? "bg-surface-3 text-ink-2" : c.ok ? "bg-up text-bg" : "bg-down text-bg",
                )}
              >
                {c.ok === null ? (
                  <Minus size={12} strokeWidth={3} />
                ) : c.ok ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <X size={12} strokeWidth={3} />
                )}
              </span>
              <span className={c.ok === false ? "text-down" : c.ok === null ? "text-ink-2" : "text-ink"}>{c.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2 text-[13px]">
        <h3 className="type-title">What stays public</h3>
        <p className="text-ink-2">
          This wallet's own trades on {venue.name}; its funding, at a standard size, and its trip home, at whatever it
          held; and NEAR Intents' record of each swap. None of it names you or your other wallets.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold text-warning">
          <Eye size={14} /> Looking it up yourself
        </span>
        <p className="text-ink-2">
          These pages load straight from your browser, so the site sees your IP address next to this wallet. Open them
          on Tor or a VPN.
        </p>
        <div className="flex flex-wrap gap-2">
          {venue.explorers(w.address).map((e) => (
            <a
              key={e.href}
              href={e.href}
              target="_blank"
              rel="noreferrer noopener"
              referrerPolicy="no-referrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-strong px-3 py-1.5 font-medium hover:bg-surface-1"
            >
              {e.label} <ExternalLink size={12} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
