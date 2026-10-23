"use client";

import { MarketChart } from "@mitoshi/chart";
import { useEffect, useRef, useState } from "react";
import { RollingNumber } from "@/kit";
import { price } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { DRIVERS, useLiveStats, usePerpMarkets } from "../perps/hooks";
import type { PerpVenue } from "../perps/model";

const MASK_DOTS = ["a", "b", "c", "d"];
/** "From anywhere": the hero walks through a coin, a stock and gold, each on its own venue. */
const SHOWN: readonly { venue: PerpVenue; id: string; label: string }[] = [
  { venue: "hyperliquid", id: "BTC", label: "BTC-PERP · Hyperliquid" },
  { venue: "pmperps", id: "NVDA-USD", label: "NVIDIA · Polymarket Perps" },
  { venue: "pmperps", id: "GOLD-USD", label: "Gold · Polymarket Perps" },
];
const ROTATE_MS = 9_000;
const PRICE_SIG = 6;
const VENUE_MARK = { hyperliquid: "hyperliquid", pmperps: "polymarket" } as const;
/** Illustrative wallets for the "what the public sees" card, one per shown market. */
const FRESH = ["0x91c2…3fd8", "0x4e07…a9b1", "0xd35a…0c62"];

/**
 * The hero's product shot, live: a market's price line from the public feed (through Mitoshi's relay, as in the app),
 * what a copy trader would find of the wallet trading it, and the shielded balance it came from, fanned around it.
 */
export function HeroVisual() {
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const [at, setAt] = useState(0);
  const shown = SHOWN[at] ?? SHOWN[0];
  const hl = usePerpMarkets("hyperliquid");
  const pm = usePerpMarkets("pmperps");
  const market = [...(hl.data ?? []), ...(pm.data ?? [])].find(
    (m) => shown && m.venue === shown.venue && m.id === shown.id,
  );
  const stats = useLiveStats(market);
  const px = stats?.markPx ?? market?.markPx;

  useEffect(() => {
    const t = setInterval(() => setAt((i) => (i + 1) % SHOWN.length), ROTATE_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!box.current || !root.current) return;
    const c = new MarketChart(box.current, { mode: "live", format: price, colorsFrom: root.current });
    chart.current = c;
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  const key = market ? `${market.venue}:${market.id}` : "";
  useEffect(() => {
    chart.current?.reset();
    if (!market) return;
    return DRIVERS[market.venue].subscribePrice(market, (p) => chart.current?.pushPrice(p));
    // One subscription per market; the list refreshing does not restart it.
  }, [key]);

  return (
    <div ref={root} className="relative mx-auto aspect-[4/5] w-full max-w-[560px] sm:aspect-[5/4]">
      <div className="lp-card absolute inset-x-0 top-0 bottom-[30%] flex flex-col overflow-hidden sm:inset-x-[6%] sm:top-[4%] sm:bottom-[14%]">
        <div className="flex items-center gap-3 p-4">
          <span className="relative shrink-0">
            <Mark symbol={market?.name ?? shown?.id ?? "BTC"} src={market?.logo ?? null} size={36} />
            {shown ? (
              <VenueMark
                venue={VENUE_MARK[shown.venue]}
                size={15}
                className="absolute -right-0.5 -bottom-0.5 ring-2 ring-[var(--lp-card)]"
              />
            ) : null}
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[12px] text-[var(--lp-ink-3)]">{shown?.label} · live</span>
            {px ? (
              <RollingNumber
                value={px}
                format={{ maximumSignificantDigits: PRICE_SIG }}
                className="font-semibold text-[24px] text-[var(--lp-ink)]"
              />
            ) : (
              <span className="num font-semibold text-[24px] text-[var(--lp-ink-3)]">connecting…</span>
            )}
          </div>
          <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--up-wash)] px-2.5 py-1 font-medium text-[12px] text-[var(--up)]">
            <span className="size-1.5 rounded-full bg-[var(--up)]" /> Long 5×
            <span className="hidden sm:inline"> · fresh wallet</span>
          </span>
        </div>
        <div ref={box} className="relative min-h-0 flex-1" />
      </div>

      <div className="lp-card lp-card-2 lp-rise absolute right-0 bottom-0 w-[66%] max-w-[300px] p-4 sm:w-[58%] [animation-delay:200ms]">
        <div className="flex items-center gap-2">
          {shown ? <VenueMark venue={VENUE_MARK[shown.venue]} size={18} /> : null}
          <span className="font-mono text-[10px] text-[var(--lp-ink-3)] uppercase tracking-[0.14em]">
            What the public sees
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 whitespace-nowrap text-[12px]">
          <dt className="text-[var(--lp-ink-3)]">Wallet</dt>
          <dd className="num whitespace-nowrap text-right">{FRESH[at] ?? FRESH[0]}</dd>
          <dt className="text-[var(--lp-ink-3)]">Trades</dt>
          <dd className="num text-right">1</dd>
          <dt className="text-[var(--lp-ink-3)]">History before</dt>
          <dd className="text-right text-[var(--up)]">none</dd>
          <dt className="text-[var(--lp-ink-3)]">Links to others</dt>
          <dd className="text-right text-[var(--up)]">none</dd>
        </dl>
        <p className="mt-2 text-right font-mono text-[9px] text-[var(--lp-ink-3)] uppercase tracking-[0.12em]">
          Example
        </p>
      </div>

      <div className="lp-rise absolute bottom-[6%] left-0 w-[40%] max-w-[230px] sm:w-[46%] rounded-[20px] bg-[#141210] p-4 shadow-[0_30px_60px_-30px_#000,inset_0_0_0_1px_rgb(244_238_227/0.08)] [animation-delay:350ms]">
        <span className="flex items-center gap-1.5 text-[11px] text-[#f4eee3]/60">
          <Mark symbol="ZEC" size={14} /> Shielded ZEC
        </span>
        <span className="mt-2 flex gap-1.5">
          {MASK_DOTS.map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-[#f4eee3]" />
          ))}
        </span>
        <span className="mt-2 block text-[#f4eee3]/45 text-[12px]">
          <span className="font-stamp">隠</span> · only in this browser
        </span>
      </div>
    </div>
  );
}
