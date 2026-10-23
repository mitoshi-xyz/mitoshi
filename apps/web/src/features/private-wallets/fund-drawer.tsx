"use client";

import { fundableSizes, LADDER_ZAT, type Venue, ZAT_PER_ZEC } from "@mitoshi/engine";
import { APP_FEE_BPS, APP_FEE_RECIPIENT } from "@mitoshi/rails";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, ChevronDown, Clock, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, cx, Sheet, Skeleton, TxSteps } from "@/kit";
import { VenueMark } from "../marks/mark";
import { LeakMeter } from "../privacy/leak-meter";
import { MASK, useHideAmounts } from "../shell/prefs";
import { useWallet } from "../wallet/wallet-store";
import { balances, canFund, confidentialSwaps, FUNDING_FEE_RESERVE_ZAT, prepareWallet, previewFunding } from "./jobs";
import { useRegistry } from "./registry-store";
import { useNow } from "./use-now";
import { shortAddress, VENUE_ORDER, VENUES } from "./venues";
import { fundingSteps, inMinutes } from "./wallet-steps";

const ZEC_DIGITS = 8;
const QUOTE_DEBOUNCE_MS = 400;
const QUOTE_STALE_MS = 30_000;
const MS_PER_SECOND = 1000;
const BPS_PER_PERCENT = 100;
const USD_DIGITS = 2;
const OUT_DIGITS = 4;

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** After "Fund privately": the new wallet's own funding, live, until it is ready to trade. */
function LiveFunding({ id, onPublic }: { id: string; onPublic: (id: string) => void }) {
  const registry = useRegistry();
  const now = useNow();
  const w = registry.wallets.find((x) => x.id === id);
  if (!w) return null;
  const venue = VENUES[w.venue];
  const ready = w.status === "ready";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-hairline bg-bg p-4">
        <VenueMark venue={w.venue} size={36} />
        <div className="flex flex-col">
          <span className="font-medium">New {venue.name} wallet</span>
          <span className="num text-[12px] text-muted">
            {shortAddress(w.address)} · {zec(w.sizeZat)} ZEC
          </span>
        </div>
      </div>
      <TxSteps steps={fundingSteps(w, now)} />
      {ready ? (
        <Link
          href={venue.trade.href}
          className="inline-flex h-[52px] items-center justify-center gap-2 rounded-md bg-accent font-semibold text-[16px] text-accent-ink hover:brightness-110"
        >
          {venue.trade.label} <ArrowRight size={18} />
        </Link>
      ) : (
        <p className="flex items-center gap-1.5 text-[13px] text-muted">
          <Clock size={13} /> Carries on while Mitoshi is open
        </p>
      )}
      <button
        type="button"
        onClick={() => onPublic(w.id)}
        className="inline-flex items-center gap-1.5 self-start text-[13px] text-ink-2 hover:text-ink"
      >
        <Eye size={14} /> What the public will see
      </button>
    </div>
  );
}

/**
 * Funding a new private wallet: pick the venue and a standard size, see NEAR's price for it (a dry
 * quote; nothing moves) and the leak meter, then fund. The wallet starts at a random moment in
 * the next few minutes, so its funding can't be matched to this click.
 */
export function FundDrawer({
  open,
  onClose,
  onPublic,
  venue: initialVenue = "polymarket",
}: {
  open: boolean;
  onClose: () => void;
  onPublic: (id: string) => void;
  venue?: Venue;
}) {
  const w = useWallet();
  const [hidden] = useHideAmounts();
  const [venue, setVenue] = useState<Venue>(initialVenue);
  const [size, setSize] = useState<number>(LADDER_ZAT[2]);
  const [made, setMade] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const allowed = canFund();
  const { spendable, resting } = balances();
  const affordable = new Set(allowed.ok ? fundableSizes(spendable, FUNDING_FEE_RESERVE_ZAT) : []);
  const key = useDebounced({ venue, size }, QUOTE_DEBOUNCE_MS);

  useEffect(() => {
    if (open) {
      setMade(null);
      setError(null);
      setVenue(initialVenue);
    }
  }, [open, initialVenue]);

  const preview = useQuery({
    queryKey: ["fund-preview", key.venue, key.size],
    enabled: open && allowed.ok && VENUES[key.venue].live && w.phase === "ready",
    staleTime: QUOTE_STALE_MS,
    retry: false,
    queryFn: () => previewFunding(key.venue, key.size),
  });
  const p = preview.data;
  const settling = key.venue !== venue || key.size !== size;

  const ready = affordable.has(size);
  const cta = made ? null : !allowed.ok ? null : (
    <Button
      tone="primary"
      size="lg"
      className="h-[52px] w-full text-[16px]"
      disabled={!p || settling || busy || p.leak.level === "red" || !ready}
      onClick={() => {
        setBusy(true);
        setError(null);
        prepareWallet(venue, size)
          .then(
            (made) => setMade(made.id),
            (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
          )
          .finally(() => setBusy(false));
      }}
    >
      {ready ? "Fund privately" : `Deposit ${zec(size + FUNDING_FEE_RESERVE_ZAT)} ZEC first`}
    </Button>
  );

  return (
    <Sheet open={open} onClose={onClose} title={made ? "Funding privately" : "New private wallet"} footer={cta}>
      {made ? (
        <LiveFunding id={made} onPublic={onPublic} />
      ) : !allowed.ok ? (
        <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 text-[14px]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <p>{allowed.why}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
            {VENUE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                disabled={!VENUES[id].live}
                aria-pressed={venue === id}
                onClick={() => setVenue(id)}
                className={cx(
                  "flex h-11 items-center justify-center gap-2 rounded-lg font-medium text-[13px] disabled:opacity-40",
                  venue === id ? "bg-surface-1 text-ink shadow-sm" : "text-ink-2 hover:text-ink",
                )}
              >
                <VenueMark venue={id} size={20} />
                {VENUES[id].name}
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center gap-1 pt-2">
            <span className="flex items-baseline gap-1.5">
              <span className="num font-semibold text-[48px] leading-none">{zec(size)}</span>
              <span className="font-semibold text-[18px] text-muted">ZEC</span>
            </span>
            <span className={cx("num text-[13px]", ready ? "text-ink-2" : "text-warning")}>
              {hidden ? MASK : zec(spendable)} ZEC ready
              {resting > 0 ? ` · ${hidden ? MASK : zec(resting)} resting` : ""}
            </span>
          </div>
          <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none]">
            {LADDER_ZAT.map((sz) => (
              <button
                key={sz}
                type="button"
                aria-pressed={size === sz}
                onClick={() => setSize(sz)}
                className={cx(
                  "num h-9 shrink-0 rounded-full px-3.5 text-[13px] transition-colors duration-[var(--dur-hover)]",
                  size === sz ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink",
                  !affordable.has(sz) && size !== sz && "opacity-45",
                )}
              >
                {zec(sz)}
              </button>
            ))}
          </div>

          <section className="flex flex-col gap-2" aria-live="polite">
            {preview.isError ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-down-wash px-4 py-3 text-[13px]">
                <span className="text-down">NEAR Intents gave no price</span>
                <button type="button" onClick={() => void preview.refetch()} className="text-accent hover:underline">
                  Ask again
                </button>
              </div>
            ) : !p || settling ? (
              <Skeleton className="h-14 rounded-xl" label="Asking NEAR Intents for a price, privately" />
            ) : (
              <details className="group rounded-xl bg-surface-2">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                  <span className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="text-[11px] text-muted">A new wallet gets</span>
                    <span className="num font-semibold text-[17px]">
                      ≈ {Number(p.credited?.out ?? p.out).toFixed(OUT_DIGITS)} {p.credited?.symbol ?? p.symbol}
                    </span>
                  </span>
                  <span className="num text-right text-[12px] text-ink-2 leading-tight">
                    ≈ ${Number(p.usd).toFixed(USD_DIGITS)}
                    <br />
                    {inMinutes(p.seconds * MS_PER_SECOND)}
                  </span>
                  <ChevronDown size={14} className="text-muted transition-transform group-open:rotate-180" />
                </summary>
                <dl className="grid grid-cols-2 gap-y-1.5 border-hairline border-t px-4 py-3 text-[13px]">
                  <dt className="text-ink-2">Network fee</dt>
                  <dd className="num text-right">{zec(FUNDING_FEE_RESERVE_ZAT)} ZEC</dd>
                  <dt className="text-ink-2">Mitoshi fee</dt>
                  <dd className="num text-right">{APP_FEE_RECIPIENT ? `${APP_FEE_BPS / BPS_PER_PERCENT}%` : "none"}</dd>
                  {p.credited ? (
                    <>
                      <dt className="text-ink-2">Bridge to pUSD</dt>
                      <dd className="num text-right">${p.credited.feeUsd.toFixed(USD_DIGITS)}</dd>
                    </>
                  ) : null}
                  <dt className="text-ink-2">Route</dt>
                  <dd className="text-right">
                    NEAR Intents{p.via ? ` · ${p.via}` : ""}
                    {confidentialSwaps() ? " · confidential" : ""}
                  </dd>
                </dl>
              </details>
            )}
            {p && !settling ? <LeakMeter report={p.leak} blocks /> : null}
          </section>
          {error ? <p className="text-[13px] text-down">{error}</p> : null}
        </>
      )}
    </Sheet>
  );
}
