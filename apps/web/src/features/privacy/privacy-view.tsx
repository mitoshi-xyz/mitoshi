"use client";

import {
  Clock,
  Eye,
  EyeOff,
  Fingerprint,
  Globe2,
  KeyRound,
  Layers,
  MailX,
  RefreshCcw,
  Ruler,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { cx } from "@/kit";
import { type Venue, VenueMark } from "../marks/mark";
import { openPublicView } from "../private-wallets/drawers";
import { confidentialSwaps } from "../private-wallets/jobs";
import { linkChecks } from "../private-wallets/public-view";
import { useRegistry } from "../private-wallets/registry-store";
import { shortAddress } from "../private-wallets/venues";
import { StatusPill } from "../private-wallets/wallet-card";

interface Party {
  name: string;
  mark?: Venue;
  icon?: typeof Eye;
  sees: string;
  never: string;
}

const PARTIES: Party[] = [
  {
    name: "Your browser",
    icon: Fingerprint,
    sees: "Everything: your words, your balance, which wallets are yours",
    never: "Sends any of it anywhere. It is encrypted in this browser's vault",
  },
  {
    name: "Mitoshi relay (Cloudflare)",
    icon: Globe2,
    sees: "Your IP address, and that a sealed request went by",
    never: "What you asked, or which wallet it was about (OHTTP seals it for the gateway)",
  },
  {
    name: "Mitoshi gateway (Ireland)",
    icon: Layers,
    sees: "What one request asks, like one address's balance",
    never: "Who asked: no IP, no cookies, no account. It keeps nothing",
  },
  {
    name: "Hyperliquid, Solana, Polymarket",
    mark: "hyperliquid",
    sees: "One fresh wallet's trades, coming from the gateway's address",
    never: "Your other wallets, your ZEC, or your IP",
  },
  {
    name: "NEAR Intents",
    mark: "near",
    sees: "Each swap: a standard ZEC amount in, a fresh wallet out",
    never: "Which swaps are yours: each one has its own fresh refund and payout address",
  },
  {
    name: "The Zcash chain",
    mark: "zcash",
    sees: "That a shielded transaction happened, plus the one public hop to NEAR's deposit address",
    never: "Your balance, your addresses, or amounts inside the shielded pool",
  },
];

const RULES = [
  { icon: KeyRound, text: "A new wallet for every trade, on its own key path from your words." },
  { icon: Ruler, text: "Standard sizes only (0.01 to 1 ZEC), so a funding looks like everyone else's." },
  { icon: Timer, text: "Each funding starts at a random moment, never the moment you tap." },
  { icon: Clock, text: "Money that arrives from a public address rests 2–6 hours before it can fund anything." },
  { icon: RefreshCcw, text: "Every swap gets a fresh shielded address for its refund and its payout." },
  { icon: MailX, text: "No memos, and the standard transaction shape, so nothing stands out on chain." },
  { icon: EyeOff, text: "Every request is sealed with OHTTP; every picture comes through Mitoshi's image proxy." },
  {
    icon: ShieldCheck,
    text: "Each wallet is read on its own random schedule, so no venue sees them asked about together.",
  },
];

/** Privacy: your wallets as the public sees them, who sees what, and the rules that keep it apart. */
export function PrivacyView() {
  const registry = useRegistry();
  const live = registry.wallets.filter((w) => !["retired", "refunded"].includes(w.status));
  const linked = registry.wallets.filter((w) => linkChecks(w, registry).some((c) => !c.ok));
  return (
    <section className="flex flex-col gap-10">
      <div className="flex max-w-2xl flex-col gap-1">
        <h1 className="type-headline-lg">Privacy</h1>
        <p className="text-ink-2">Who can see what, and why none of it adds up to you.</p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="type-title">Your wallets, as the public sees them</h2>
          {registry.wallets.length ? (
            <span className={cx("text-[13px]", linked.length ? "text-down" : "text-up")}>
              {registry.wallets.length} wallet{registry.wallets.length === 1 ? "" : "s"} · links between them:{" "}
              {linked.length ? `${linked.length} found` : "none"}
            </span>
          ) : null}
        </div>
        {live.length === 0 ? (
          <p className="rounded-xl border border-hairline bg-surface-1 p-4 text-[13px] text-ink-2">
            No live private wallets. Each one you fund shows up here with exactly what a copy trader can find.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {live.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => openPublicView(w.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface-1 p-3 text-left hover:border-strong"
                >
                  <VenueMark venue={w.venue} size={30} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="num text-[13px]">{shortAddress(w.address)}</span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                      <Eye size={12} /> What the public sees
                    </span>
                  </span>
                  <StatusPill w={w} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-title">Who sees what</h2>
        <ul className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
          {PARTIES.map((p) => (
            <li
              key={p.name}
              className="grid grid-cols-1 gap-2 border-hairline border-b px-4 py-3.5 text-[13px] last:border-b-0 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
            >
              <span className="flex items-center gap-2.5 font-medium text-[14px]">
                {p.mark ? (
                  <VenueMark venue={p.mark} size={22} />
                ) : p.icon ? (
                  <p.icon size={18} className="text-accent" />
                ) : null}
                {p.name}
              </span>
              <span className="text-ink-2">
                <span className="type-label mr-1.5 text-muted">Sees</span>
                {p.sees}
              </span>
              <span className="text-ink-2">
                <span className="type-label mr-1.5 text-up">Never</span>
                {p.never}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[12px] text-muted">
          NEAR's confidential mode, which also hides who is on each side of a swap from NEAR's public explorer, is{" "}
          {confidentialSwaps() ? "on for your swaps" : "off: it needs a NEAR partner key on the gateway"}.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="type-title">What Mitoshi does so nothing links</h2>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {RULES.map((r) => (
            <li key={r.text} className="flex gap-3 rounded-xl border border-hairline bg-surface-1 p-3.5 text-[13px]">
              <r.icon size={17} className="mt-0.5 shrink-0 text-accent" />
              {r.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4 text-[13px]">
          <h2 className="type-title">The leak meter</h2>
          <p className="text-ink-2">
            On every send it checks what an onlooker could match: a funding that isn't a standard size or would spend
            resting money; a withdrawal to a public address that equals or comes soon after money that came home. Red
            stops a funding; on a withdrawal it warns, because the choice is yours.
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4 text-[13px]">
          <h2 className="type-title">What stays public</h2>
          <p className="text-ink-2">
            Each wallet's own trades on its venue; one hop in and one hop out, at a standard size; and NEAR Intents'
            record of each swap. None of it carries your name, your IP, or a link to your other wallets.
          </p>
        </div>
      </section>
    </section>
  );
}
