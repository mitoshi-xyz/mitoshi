"use client";

import { fundableSizes, LADDER_ZAT, type Venue, ZAT_PER_ZEC } from "@mitoshi/engine";
import { APP_FEE_BPS, APP_FEE_RECIPIENT } from "@mitoshi/rails";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Eye } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, cx, Drawer, Skeleton, TxSteps } from "@/kit";
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
        <p className="text-[13px] text-ink-2">
          You can close this: the funding carries on while Mitoshi is open, and the card on Private wallets follows it.
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

  return (
    <Drawer open={open} onClose={onClose} title={made ? "Funding privately" : "New private wallet"} wide>
      {made ? (
        <LiveFunding id={made} onPublic={onPublic} />
      ) : !allowed.ok ? (
        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-[14px]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <p>{allowed.why}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="type-label mb-2 text-muted">Trade on</legend>
            <div className="grid grid-cols-3 gap-2">
              {VENUE_ORDER.map((id) => {
                const v = VENUES[id];
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!v.live}
                    aria-pressed={venue === id}
                    onClick={() => setVenue(id)}
                    className={cx(
                      "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors duration-[var(--dur-hover)] disabled:cursor-not-allowed disabled:opacity-45",
                      venue === id ? "border-accent bg-accent-wash" : "border-hairline hover:border-strong",
                    )}
                  >
                    <VenueMark venue={id} size={28} />
                    <span className="font-medium text-[14px]">{v.name}</span>
                    <span className="text-[11px] text-muted">
                      {v.live ? `Gets ${v.gets}` : "Opens with Polymarket trading"}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 flex w-full items-baseline justify-between">
              <span className="type-label text-muted">Size</span>
              <span className="num text-[12px] text-ink-2">
                {hidden ? MASK : `${zec(spendable)} ZEC`} ready
                {resting > 0 ? ` · ${hidden ? MASK : zec(resting)} resting` : ""}
              </span>
            </legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {LADDER_ZAT.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  aria-pressed={size === sz}
                  onClick={() => setSize(sz)}
                  className={cx(
                    "num h-10 rounded-md border text-[13px] transition-colors duration-[var(--dur-hover)]",
                    size === sz ? "border-ink bg-ink text-bg" : "border-hairline hover:border-strong",
                    !affordable.has(sz) && size !== sz && "opacity-45",
                  )}
                >
                  {zec(sz)}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-muted">
              Standard sizes only, so the one public hop looks like everyone else's.
              {affordable.has(size) ? "" : " You don't have this much ready yet: the price below is still real."}
            </p>
          </fieldset>

          <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-bg p-4" aria-live="polite">
            {!VENUES[venue].live ? (
              <div className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium">
                  {VENUES[venue].name} wallets open with {VENUES[venue].name} trading
                </span>
                <span className="text-ink-2">
                  Until then, a Hyperliquid or Solana wallet funds the same way, from the same shielded ZEC.
                </span>
              </div>
            ) : preview.isError ? (
              <div className="flex flex-col gap-2 text-[13px]">
                <span className="font-medium text-down">NEAR Intents didn't give a price</span>
                <span className="text-ink-2">{preview.error.message}</span>
                <button
                  type="button"
                  onClick={() => void preview.refetch()}
                  className="self-start text-accent hover:underline"
                >
                  Ask again
                </button>
              </div>
            ) : !p || settling ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-40" label="Asking NEAR Intents for a price, privately" />
                <Skeleton className="h-9 w-56" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <span className="type-label text-muted">A brand-new wallet gets</span>
                <span className="flex items-baseline gap-2">
                  <span className="num font-semibold text-[32px] leading-none">
                    ≈ {Number(p.credited?.out ?? p.out).toFixed(OUT_DIGITS)}
                  </span>
                  <span className="font-semibold text-[16px] text-ink-2">{p.credited?.symbol ?? p.symbol}</span>
                </span>
                <span className="num text-[13px] text-ink-2">
                  ≈ ${Number(p.usd).toFixed(USD_DIGITS)} · ready in {inMinutes(p.seconds * MS_PER_SECOND)} after it
                  starts
                </span>
                <dl className="grid grid-cols-2 gap-y-1.5 border-hairline border-t pt-3 text-[13px]">
                  <dt className="text-ink-2">You send</dt>
                  <dd className="num text-right">{zec(size)} ZEC, shielded</dd>
                  <dt className="text-ink-2">Network fee</dt>
                  <dd className="num text-right">about {zec(FUNDING_FEE_RESERVE_ZAT)} ZEC</dd>
                  <dt className="text-ink-2">Mitoshi fee</dt>
                  <dd className="num text-right">
                    {APP_FEE_RECIPIENT ? `${APP_FEE_BPS / BPS_PER_PERCENT}%, included` : "none"}
                  </dd>
                  {p.credited ? (
                    <>
                      <dt className="text-ink-2">Polymarket bridge</dt>
                      <dd className="num text-right">
                        {Number(p.out).toFixed(OUT_DIGITS)} {p.symbol} → pUSD · ${p.credited.feeUsd.toFixed(USD_DIGITS)}{" "}
                        fee
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-ink-2">Route</dt>
                  <dd className="text-right">
                    NEAR Intents{p.via ? ` via ${p.via}` : ""}
                    {confidentialSwaps() ? " · confidential" : ""}
                  </dd>
                </dl>
              </>
            )}
          </section>

          {p && !settling ? <LeakMeter report={p.leak} blocks /> : null}
          {error ? <p className="text-[13px] text-down">{error}</p> : null}

          <Button
            tone="primary"
            size="lg"
            className="h-[52px] text-[16px]"
            disabled={!p || settling || busy || p.leak.level === "red" || !affordable.has(size)}
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
            {affordable.has(size)
              ? "Fund privately"
              : `Deposit at least ${zec(size + FUNDING_FEE_RESERVE_ZAT)} ZEC first`}
          </Button>
          <p className="-mt-2 text-center text-[12px] text-muted">
            It starts at a random moment in the next few minutes, never the moment you tap.
          </p>
        </div>
      )}
    </Drawer>
  );
}
