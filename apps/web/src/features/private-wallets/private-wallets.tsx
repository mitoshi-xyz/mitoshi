"use client";

import {
  fundableSizes,
  LADDER_ZAT,
  type LeakReport,
  latestSwap,
  type PrivateWallet,
  type Venue,
  type WalletStatus,
  ZAT_PER_ZEC,
} from "@mitoshi/engine";
import { useEffect, useState } from "react";
import {
  balances,
  canFund,
  confidentialSwaps,
  FUNDING_FEE_RESERVE_ZAT,
  type FundingPreview,
  prepareWallet,
  previewFunding,
  setKeepReady,
} from "./jobs";
import { useRegistry } from "./registry-store";

const VENUES: { id: Venue; name: string; gets: string }[] = [
  { id: "polymarket", name: "Polymarket", gets: "USDC on Polygon" },
  { id: "hyperliquid", name: "Hyperliquid", gets: "USDC on Hyperliquid" },
  { id: "solana", name: "Solana", gets: "SOL" },
];

const STATUS_WORDS: Record<WalletStatus, string> = {
  preparing: "Preparing",
  funding: "Funding",
  ready: "Ready",
  trading: "Trading",
  returning: "Coming home",
  retired: "Retired",
  refunded: "Refunded",
  failed: "Needs attention",
};

const ZEC_DECIMALS = 8;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DECIMALS).replace(/\.?0+$/, "");
const ADDRESS_HEAD = 6;
const ADDRESS_TAIL = 4;
const short = (a: string) => `${a.slice(0, ADDRESS_HEAD)}…${a.slice(-ADDRESS_TAIL)}`;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const CLOCK_TICK_MS = 1000;

function minutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE))} min`;
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}

const LEVEL_STYLE: Record<LeakReport["level"], string> = {
  green: "text-emerald-400",
  amber: "text-amber-400",
  red: "text-red-400",
};

function LeakMeter({ report }: { report: LeakReport }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className={LEVEL_STYLE[report.level]}>
        Leak meter: {report.level === "green" ? "clear" : report.level === "amber" ? "careful" : "blocked"}
      </p>
      <ul className="flex flex-col gap-0.5">
        {report.reasons.map((r) => (
          <li key={r.text} className={`${LEVEL_STYLE[r.level]} opacity-80`}>
            · {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

type Step =
  | { kind: "choose" }
  | { kind: "quoting" }
  | { kind: "preview"; preview: FundingPreview }
  | { kind: "error"; message: string };

function NewWallet() {
  const [venue, setVenue] = useState<Venue>("hyperliquid");
  const [size, setSize] = useState<number>(LADDER_ZAT[2]);
  const [step, setStep] = useState<Step>({ kind: "choose" });
  const fundable = canFund();
  const { spendable } = balances();
  const affordable = new Set(fundable.ok ? fundableSizes(spendable, FUNDING_FEE_RESERVE_ZAT) : []);
  const target = VENUES.find((v) => v.id === venue);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 p-5">
      <h3 className="font-medium">New private wallet</h3>
      <div className="flex flex-wrap gap-2">
        {VENUES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => {
              setVenue(v.id);
              setStep({ kind: "choose" });
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm ${venue === v.id ? "border-white" : "border-white/20 opacity-70"}`}
          >
            {v.name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm opacity-60">Size (standard amounts only, so the one public hop blends in)</p>
        <div className="flex flex-wrap gap-2">
          {LADDER_ZAT.map((sz) => (
            <button
              key={sz}
              type="button"
              onClick={() => {
                setSize(sz);
                setStep({ kind: "choose" });
              }}
              className={`rounded-lg border px-3 py-1.5 font-mono text-sm ${size === sz ? "border-white" : "border-white/20"} ${affordable.has(sz) ? "" : "opacity-50"}`}
            >
              {zec(sz)} ZEC
            </button>
          ))}
        </div>
        {affordable.size === 0 ? (
          <p className="text-sm opacity-60">
            Deposit ZEC on Balance to fund one. You can still preview what a wallet would get.
          </p>
        ) : null}
      </div>
      {step.kind === "choose" ? (
        <button
          type="button"
          className="self-start rounded-lg border border-white/20 px-4 py-2"
          onClick={() => {
            setStep({ kind: "quoting" });
            previewFunding(venue, size).then(
              (preview) => setStep({ kind: "preview", preview }),
              (e: unknown) => setStep({ kind: "error", message: e instanceof Error ? e.message : String(e) }),
            );
          }}
        >
          Preview
        </button>
      ) : null}
      {step.kind === "quoting" ? (
        <p className="text-sm opacity-70">Asking NEAR Intents for a price, privately…</p>
      ) : null}
      {step.kind === "preview" ? (
        <div className="flex flex-col gap-3">
          <p>
            A brand-new wallet gets about{" "}
            <span className="font-mono">
              {step.preview.out} {step.preview.symbol}
            </span>{" "}
            ({target?.gets}, ≈ ${Number(step.preview.usd).toFixed(2)}) in about {minutes(step.preview.seconds)}.
          </p>
          <p className="text-sm opacity-60">
            The swap runs on NEAR Intents{confidentialSwaps() ? " in confidential mode" : ""}. No fee on your trades.
            Mitoshi's fee, when set, is 0.2% of each funding and is included above.
          </p>
          <LeakMeter report={step.preview.leak} />
          {fundable.ok ? (
            <button
              type="button"
              disabled={step.preview.leak.level === "red"}
              className="self-start rounded-lg bg-white px-4 py-2 font-medium text-black disabled:opacity-40"
              onClick={() =>
                prepareWallet(venue, size).then(
                  () => setStep({ kind: "choose" }),
                  (e: unknown) => setStep({ kind: "error", message: e instanceof Error ? e.message : String(e) }),
                )
              }
            >
              Prepare this wallet
            </button>
          ) : (
            <p className="text-sm text-amber-400">{fundable.why}</p>
          )}
        </div>
      ) : null}
      {step.kind === "error" ? (
        <div className="flex flex-col gap-2">
          <p className="text-red-400 text-sm">{step.message}</p>
          <button type="button" className="self-start text-sm underline" onClick={() => setStep({ kind: "choose" })}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}

function KeepReady() {
  const registry = useRegistry();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-5">
      <h3 className="font-medium">Keep one ready</h3>
      <p className="text-sm opacity-60">
        While Mitoshi is open, hold a funded wallet per venue so a trade never waits for the ~8-minute funding.
      </p>
      {VENUES.map((v) => {
        const size = registry.keepReady[v.id];
        return (
          <label key={v.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{v.name}</span>
            <select
              className="rounded-lg border border-white/20 bg-transparent px-2 py-1 font-mono"
              value={size ?? ""}
              onChange={(e) => setKeepReady(v.id, e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Off</option>
              {LADDER_ZAT.map((s) => (
                <option key={s} value={s}>
                  {zec(s)} ZEC
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

function WalletCard({ w, now }: { w: PrivateWallet; now: number }) {
  const venue = VENUES.find((v) => v.id === w.venue);
  const fundingSwap = latestSwap(w, "fund");
  let eta: string | null = null;
  if (w.status === "preparing" && w.fundAt) {
    eta = `starts in ${minutes(Math.max(0, (w.fundAt - now) / MS_PER_SECOND))}`;
  } else if (w.status === "funding" && fundingSwap) {
    const left = (fundingSwap.createdAt + fundingSwap.timeEstimateSeconds * MS_PER_SECOND - now) / MS_PER_SECOND;
    eta = left > 0 ? `about ${minutes(left)} left` : "any moment now";
  }
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-white/10 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{venue?.name}</span>
        <span className="text-sm">
          {STATUS_WORDS[w.status]}
          {eta ? <span className="opacity-60"> · {eta}</span> : null}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <button
          type="button"
          className="font-mono underline decoration-white/20"
          title="Copy the wallet address"
          onClick={() => void navigator.clipboard.writeText(w.address)}
        >
          {short(w.address)}
        </button>
        <span className="font-mono opacity-70">{zec(w.sizeZat)} ZEC</span>
      </div>
      <ol className="flex flex-col gap-1 border-white/10 border-l pl-3 text-xs">
        {w.timeline.map((e) => (
          <li key={`${e.status}-${e.at}-${e.note ?? ""}`} className="opacity-70">
            <span className="opacity-60">{new Date(e.at).toLocaleTimeString()}</span> {STATUS_WORDS[e.status]}
            {e.note ? `: ${e.note}` : ""}
          </li>
        ))}
      </ol>
      {w.status === "failed" && w.error ? <p className="text-red-400 text-xs">{w.error}</p> : null}
    </li>
  );
}

/** The private wallets screen: make one, keep one ready, and follow each wallet's life. */
export function PrivateWallets() {
  const registry = useRegistry();
  const now = useNow();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-xl">Private wallets</h2>
        <p className="text-sm opacity-70">
          Each trade gets a wallet that has never existed before, funded from your shielded ZEC. Nobody can link two of
          them, or any of them to you.
        </p>
      </div>
      <NewWallet />
      <KeepReady />
      {registry.wallets.length === 0 ? (
        <p className="text-sm opacity-60">No private wallets yet. Prepare one above, or switch on "Keep one ready".</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {registry.wallets.map((w) => (
            <WalletCard key={w.id} w={w} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
