"use client";

import { MarketChart } from "@mitoshi/chart";
import { useEffect, useRef } from "react";
import { RollingNumber } from "@/kit";
import { price } from "../format";
import { hlLive } from "../hyperliquid/hl";
import { useLiveMids } from "../hyperliquid/hooks";
import { Mark, VenueMark } from "../marks/mark";

const COIN = "BTC";
const MASK_DOTS = ["a", "b", "c", "d"];

/**
 * The hero's product shot, live: a BTC perp line fed by the public trade stream (through Mitoshi's
 * relay, as in the app), with what a copy trader would find of that wallet, and the shielded
 * balance it came from, fanned around it.
 */
export function HeroVisual() {
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const mids = useLiveMids();
  const px = mids[COIN];

  useEffect(() => {
    if (!box.current || !root.current) return;
    const c = new MarketChart(box.current, { mode: "live", format: price, colorsFrom: root.current });
    chart.current = c;
    const stop = hlLive().subscribe({ type: "trades", coin: COIN }, (data) => {
      const last = (data as { px: string }[]).at(-1);
      if (last) c.pushPrice(Number(last.px));
    });
    return () => {
      stop();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (px) chart.current?.pushPrice(px);
  }, [px]);

  return (
    <div ref={root} className="relative mx-auto aspect-[5/4] w-full max-w-[560px]">
      <div className="lp-card absolute inset-x-[6%] top-[4%] bottom-[14%] flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <Mark symbol={COIN} size={36} />
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] text-[var(--lp-ink-3)]">BTC-PERP · Hyperliquid · live</span>
            {px ? (
              <RollingNumber
                value={px}
                format={{ maximumFractionDigits: 1 }}
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

      <div className="lp-card lp-card-2 lp-rise absolute right-0 bottom-0 w-[58%] max-w-[300px] p-4 [animation-delay:200ms]">
        <div className="flex items-center gap-2">
          <VenueMark venue="hyperliquid" size={18} />
          <span className="font-mono text-[10px] text-[var(--lp-ink-3)] uppercase tracking-[0.14em]">
            What the public sees
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px]">
          <dt className="text-[var(--lp-ink-3)]">Wallet</dt>
          <dd className="num text-right">0x91c2…3fd8</dd>
          <dt className="text-[var(--lp-ink-3)]">Trades</dt>
          <dd className="num text-right">1</dd>
          <dt className="text-[var(--lp-ink-3)]">History before</dt>
          <dd className="text-right text-[var(--up)]">none</dd>
          <dt className="text-[var(--lp-ink-3)]">Links to others</dt>
          <dd className="text-right text-[var(--up)]">none</dd>
        </dl>
      </div>

      <div className="lp-rise absolute bottom-[6%] left-0 w-[46%] max-w-[230px] rounded-[20px] bg-[#141210] p-4 shadow-[0_30px_60px_-30px_#000,inset_0_0_0_1px_rgb(244_238_227/0.08)] [animation-delay:350ms]">
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
