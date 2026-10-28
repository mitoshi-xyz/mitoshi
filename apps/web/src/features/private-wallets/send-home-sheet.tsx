"use client";

import { type PrivateWallet, ZAT_PER_ZEC } from "@mitoshi/engine";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Home } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, cx, Sheet, Skeleton, TxSteps, Wait } from "@/kit";
import { usd } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { sendHome } from "./home";
import { type HomeLegKind, type HomePreview, previewHome } from "./home-preview";
import { useRegistry } from "./registry-store";
import { useNow } from "./use-now";
import { VENUES } from "./venues";
import { homeSteps, inMinutes } from "./wallet-steps";

const QUOTE_STALE_MS = 30_000;
const MS_PER_SECOND = 1000;
const PCT = 100;
const ZEC_DIGITS = 5;
/** Below this share of the money arriving, the fixed costs get their own line. */
const FIXED_SHOWN_SHARE = 0.1;

/** One colour per part, the same in the bar and beside its row: home bright, the costs in fading vermilion. */
const TONE: Record<HomeLegKind, string> = {
  home: "bg-up",
  venue: "bg-accent",
  near: "bg-accent/55",
  payout: "bg-accent/30",
  stays: "bg-surface-3",
};

const GATHERING: Record<PrivateWallet["venue"], string> = {
  hyperliquid: "Gathering the USDC",
  polymarket: "Selling shares and sending pUSD home",
  solana: "Selling tokens back to SOL",
};

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS);

/** Every dollar in the wallet as one bar: what comes home, then each cost, in the order the money meets it. */
function Breakdown({ p }: { p: HomePreview }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {p.legs.map((l) => (
          <span key={l.label} className={cx("min-w-[3px]", TONE[l.kind])} style={{ flexGrow: l.usd }} />
        ))}
      </div>
      <ul className="flex flex-col gap-2 text-[14px]">
        {p.legs.map((l) => (
          <li key={l.label} className="flex items-center gap-2.5">
            <span className={cx("size-2.5 shrink-0 rounded-full", TONE[l.kind])} />
            <span className={cx("flex-1", l.kind === "home" ? "font-medium" : "text-ink-2")}>
              {l.label}
              {l.kind === "home" && p.heldUsd > 0 ? (
                <span className="num font-normal text-muted"> · {Math.round((l.usd / p.heldUsd) * PCT)}%</span>
              ) : null}
            </span>
            <span className={cx("num", l.kind === "home" ? "font-medium" : "text-ink-2")}>
              {l.kind === "home" ? "" : "−"}
              {usd(l.usd)}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-2.5 border-hairline border-t pt-2 text-muted">
          <span className="flex-1">In the wallet · {p.held}</span>
          <span className="num">{usd(p.heldUsd)}</span>
        </li>
      </ul>
      {p.heldUsd > 0 && p.fixedUsd / p.heldUsd > FIXED_SHOWN_SHARE ? (
        <p className="text-[12px] text-muted">{usd(p.fixedUsd)} of this is fixed: the same on any amount.</p>
      ) : null}
    </section>
  );
}

/**
 * Sending a wallet home, in one sheet: first what reaches the shielded balance and where every other dollar goes
 * (from NEAR's own dry quote; nothing moves), then the trip itself with its countdown, without leaving the sheet.
 */
export function SendHomeSheet({ id, open, onClose }: { id: string | null; open: boolean; onClose: () => void }) {
  const registry = useRegistry();
  const w = registry.wallets.find((x) => x.id === id) ?? null;
  const now = useNow();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts from the price, not from the last trip.
  useEffect(() => {
    if (!open) return;
    setSending(false);
    setError(null);
  }, [open]);

  const preview = useQuery({
    queryKey: ["home-preview", id],
    enabled: open && !sending && w !== null,
    staleTime: QUOTE_STALE_MS,
    refetchInterval: QUOTE_STALE_MS,
    retry: false,
    queryFn: () => previewHome(w as PrivateWallet),
  });
  const p = preview.data;

  const go = () => {
    if (!w) return;
    setSending(true);
    setError(null);
    sendHome(w).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
      void preview.refetch();
    });
  };

  const venue = w ? VENUES[w.venue] : null;
  // Once the wallet is on its way (or the trip ended: home, or refunded back to it), the sheet follows the trip.
  const onTrip = sending && w !== null && (w.status === "returning" || w.status === "retired" || w.status === "failed");
  const big = "h-[52px] w-full text-[16px]";
  const footer =
    !w || !venue ? null : onTrip ? (
      w.status === "returning" ? null : (
        <Button tone="primary" size="lg" className={big} onClick={onClose}>
          Done
        </Button>
      )
    ) : sending ? null : p?.blocked ? (
      <Link
        href={venue.trade.href}
        onClick={onClose}
        className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink font-semibold text-[16px] text-bg hover:brightness-110"
      >
        {p.blocked} <ArrowRight size={16} />
      </Link>
    ) : p?.dust ? (
      <Button size="lg" className={big} disabled>
        Less than the trip home costs
      </Button>
    ) : (
      <Button tone="primary" size="lg" className={big} icon={<Home size={17} />} disabled={!p} onClick={go}>
        {p ? `Send ${zec(p.outZat)} ZEC home` : "Send home"}
      </Button>
    );

  return (
    <Sheet open={open} onClose={onClose} title={onTrip ? "Coming home" : "Send home"} footer={footer}>
      {!w || !venue ? null : onTrip ? (
        <TxSteps steps={homeSteps(w, now)} />
      ) : sending ? (
        <Wait verb={GATHERING[w.venue]} />
      ) : (
        <>
          <div className="flex items-center gap-2 text-[13px] text-ink-2">
            <VenueMark venue={w.venue} size={18} /> {venue.name} → your shielded balance
          </div>
          {preview.isError ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-down-wash px-4 py-3 text-[13px]">
              <span className="text-down">NEAR Intents gave no price</span>
              <button type="button" onClick={() => void preview.refetch()} className="text-accent hover:underline">
                Ask again
              </button>
            </div>
          ) : !p ? (
            <Skeleton className="h-48 rounded-xl" label="Asking NEAR Intents for a price, privately" />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[12px] text-muted">You get</span>
                <span className="flex items-center gap-2.5">
                  <Mark symbol="ZEC" size={30} />
                  <span className="num font-semibold text-[32px] leading-none">{zec(p.outZat)}</span>
                  <span className="text-[15px] text-ink-2">ZEC</span>
                </span>
                <span className="num text-[13px] text-ink-2">
                  ≈ {usd(p.outUsd)}
                  {p.seconds ? ` · ${inMinutes(p.seconds * MS_PER_SECOND)}` : ""} · rests 2–6 h
                </span>
              </div>
              <Breakdown p={p} />
            </>
          )}
        </>
      )}
      {error ? <p className="text-[13px] text-down">{error}. Your money is where it was.</p> : null}
    </Sheet>
  );
}
