"use client";

import { latestSwap, type PrivateWallet, ZAT_PER_ZEC } from "@mitoshi/engine";
import { ArrowRight, Check, ChevronDown, Copy, Eye, Home, RotateCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, cx, LiveDot, TxSteps, Wait } from "@/kit";
import { useJudgeDesk } from "../judge/judge";
import { VenueMark } from "../marks/mark";
import { MASK, useHideAmounts } from "../shell/prefs";
import { sendHome } from "./home";
import { retryWallet } from "./jobs";
import { STATUS, shortAddress, type Tone, VENUES } from "./venues";
import { fundingSteps, homeSteps, venueAmount } from "./wallet-steps";

const ZEC_DIGITS = 8;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

function age(ms: number): string {
  const m = Math.floor(ms / MS_PER_MINUTE);
  if (m < 1) return "just now";
  if (m < MINUTES_PER_HOUR) return `${m} min ago`;
  const h = Math.floor(m / MINUTES_PER_HOUR);
  return h < HOURS_PER_DAY ? `${h} h ago` : `${Math.floor(h / HOURS_PER_DAY)} d ago`;
}

const PILL: Record<Tone, string> = {
  muted: "bg-surface-2 text-ink-2",
  accent: "bg-accent-wash text-accent",
  up: "bg-up-wash text-up",
  warning: "bg-warning/15 text-warning",
  down: "bg-down-wash text-down",
};

export function StatusPill({ w }: { w: PrivateWallet }) {
  const s = STATUS[w.status];
  return (
    <span
      className={cx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-medium text-[12px]", PILL[s.tone])}
    >
      {s.live ? <LiveDot tone={s.tone === "up" ? "up" : s.tone === "accent" ? "accent" : "muted"} /> : null}
      {s.word}
    </span>
  );
}

/** Which flow a wallet's card follows: its funding, or its trip home. */
function flow(w: PrivateWallet): "fund" | "home" | "live" {
  if (w.status === "ready" || w.status === "trading") return "live";
  if (w.status === "returning" || w.status === "retired" || latestSwap(w, "return")) return "home";
  return "fund";
}

/**
 * One private wallet: its venue, address, size and status, the steps of whatever it is doing
 * (funding or coming home), and what you can do with it now.
 */
export function WalletCard({ w, now, onPublic }: { w: PrivateWallet; now: number; onPublic: (id: string) => void }) {
  const [hidden] = useHideAmounts();
  const [copied, setCopied] = useState(false);
  const [confirmHome, setConfirmHome] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState(false);
  const venue = VENUES[w.venue];
  const fund = latestSwap(w, "fund");
  const which = flow(w);
  // The judges' wallet is shared: it stays on its venue for the next judge.
  const shared = useJudgeDesk() !== null;

  const goHome = () => {
    setBusy(true);
    setError(null);
    sendHome(w)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => {
        setBusy(false);
        setConfirmHome(false);
      });
  };

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex items-start gap-3">
        <VenueMark venue={w.venue} size={36} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium">{venue.name}</span>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(w.address);
              setCopied(true);
            }}
            className="num inline-flex items-center gap-1 self-start text-[12px] text-muted hover:text-ink"
            title="Copy the address"
          >
            {shortAddress(w.address)} {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        </div>
        <StatusPill w={w} />
      </div>

      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="num">
          {w.recovered ? "Found from your words" : hidden ? MASK : `${zec(w.sizeZat)} ZEC`}
          {fund?.settledOut ? (
            <span className="text-ink-2"> → {hidden ? MASK : venueAmount(w, fund.settledOut)}</span>
          ) : null}
        </span>
        <span className="text-muted">made {age(now - w.createdAt)}</span>
      </div>

      {which === "fund" ? <TxSteps steps={fundingSteps(w, now)} /> : null}
      {which === "home" ? <TxSteps steps={homeSteps(w, now)} /> : null}

      {confirmHome ? (
        <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-bg p-3 text-[13px]">
          <p>
            Close everything on {venue.name} at market and send the money home to a fresh shielded address? It arrives
            in a few minutes and rests 2–6 h.
          </p>
          {busy ? (
            <Wait
              verb={
                w.venue === "hyperliquid"
                  ? "Closing positions and gathering USDC"
                  : w.venue === "polymarket"
                    ? "Selling shares and sending pUSD home"
                    : "Selling tokens back to SOL"
              }
            />
          ) : (
            <div className="flex gap-2">
              <Button tone="primary" icon={<Home size={15} />} onClick={goHome}>
                Send home
              </Button>
              <Button onClick={() => setConfirmHome(false)}>Not now</Button>
            </div>
          )}
        </div>
      ) : null}
      {error ? <p className="text-[12px] text-down">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        {which === "live" ? (
          <>
            <Link
              href={venue.trade.href}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 font-medium text-[13px] text-bg hover:brightness-110"
            >
              {venue.trade.label} <ArrowRight size={14} />
            </Link>
            {!confirmHome && venue.live && !shared ? (
              <button
                type="button"
                onClick={() => setConfirmHome(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-strong px-4 font-medium text-[13px] hover:bg-surface-2"
              >
                <Home size={14} /> Send home
              </button>
            ) : null}
          </>
        ) : null}
        {w.status === "failed" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => (latestSwap(w, "return") ? goHome() : retryWallet(w.id))}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 font-medium text-[13px] text-bg hover:brightness-110 disabled:opacity-50"
          >
            <RotateCw size={14} className={busy ? "animate-spin" : ""} /> Try again
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onPublic(w.id)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 font-medium text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          <Eye size={14} /> What the public sees
        </button>
        <button
          type="button"
          onClick={() => setTimeline(!timeline)}
          aria-expanded={timeline}
          className="ml-auto inline-flex h-9 items-center gap-1 px-2 text-[12px] text-muted hover:text-ink"
        >
          Timeline <ChevronDown size={13} className={cx("transition-transform", timeline && "rotate-180")} />
        </button>
      </div>

      {timeline ? (
        <ol className="flex flex-col gap-1.5 border-hairline border-t pt-3 text-[12px]">
          {w.timeline.map((e) => (
            <li key={`${e.status}-${e.at}-${e.note ?? ""}`} className="flex gap-3">
              <span className="num w-16 shrink-0 text-muted">
                {new Date(e.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="text-ink-2">
                <span className="text-ink">{STATUS[e.status].word}</span>
                {e.note ? ` · ${e.note}` : ""}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}
