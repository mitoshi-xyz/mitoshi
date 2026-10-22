"use client";

import { MarketChart } from "@mitoshi/chart";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChangeChip, cx, RollingNumber } from "@/kit";
import { price } from "../format";
import { hlLive } from "../hyperliquid/hl";
import { perpByName, useLiveMids, usePerps } from "../hyperliquid/hooks";
import { Mark } from "../marks/mark";

const HERO_COINS = ["BTC", "ETH", "SOL", "HYPE", "ZEC"] as const;
const PRICE_SIG = 7;

/** The Markets hero: one live market at 60 Hz, and the two buttons that open it from a brand-new wallet. */
export function MarketsHero() {
  const [coin, setCoin] = useState<(typeof HERO_COINS)[number]>("BTC");
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const perps = usePerps();
  const mids = useLiveMids();
  const perp = perpByName(perps.data, coin);
  const live = mids[coin] ?? perp?.markPx ?? 0;
  const change = perp && perp.prevDayPx > 0 ? live / perp.prevDayPx - 1 : 0;

  useEffect(() => {
    if (!box.current) return;
    const c = new MarketChart(box.current, { mode: "live", format: price });
    chart.current = c;
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const feed = hlLive();
    const stop = feed.subscribe({ type: "trades", coin }, (data) => {
      const last = (data as { px: string }[]).at(-1);
      if (last) chart.current?.pushPrice(Number(last.px));
    });
    const stopBbo = feed.subscribe({ type: "bbo", coin }, (data) => {
      const [bid, ask] = (data as { bbo: [{ px: string } | null, { px: string } | null] }).bbo;
      if (bid && ask) chart.current?.pushPrice((Number(bid.px) + Number(ask.px)) / 2);
    });
    return () => {
      stop();
      stopBbo();
    };
  }, [coin]);

  return (
    <section className="grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-xl border border-hairline bg-surface-1 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative flex min-h-[300px] flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Mark symbol={coin} size={40} />
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] text-muted">{coin}-PERP · Hyperliquid</span>
              <span className="flex items-baseline gap-2">
                <RollingNumber
                  value={live}
                  format={{ maximumSignificantDigits: PRICE_SIG }}
                  className="font-semibold text-[28px]"
                />
                <ChangeChip change={change} />
              </span>
            </div>
          </div>
          <div className="flex gap-1 rounded-full bg-surface-2 p-0.5">
            {HERO_COINS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCoin(c)}
                className={cx(
                  "flex items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1 text-xs",
                  coin === c ? "bg-ink text-bg" : "text-ink-2",
                )}
              >
                <Mark symbol={c} size={18} />
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-h-[240px] flex-1">
          <div ref={box} className="absolute inset-0" />
        </div>
      </div>
      <div className="flex flex-col justify-between gap-5 border-hairline border-t p-5 lg:border-t-0 lg:border-l">
        <div className="flex flex-col gap-2">
          <span className="type-label text-accent">Trade privately</span>
          <p className="type-title">Every position opens from a wallet that has never existed before.</p>
          <p className="text-[13px] text-ink-2">
            Funded from your shielded ZEC through NEAR Intents. No history, no links to you or to your other trades.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/trade#${coin}`}
            className="flex h-12 items-center justify-center gap-1.5 rounded-lg bg-up font-semibold text-bg hover:brightness-110"
          >
            <ArrowUpRight size={18} /> Long
          </Link>
          <Link
            href={`/trade#${coin}`}
            className="flex h-12 items-center justify-center gap-1.5 rounded-lg bg-down font-semibold text-bg hover:brightness-110"
          >
            <ArrowDownRight size={18} /> Short
          </Link>
        </div>
      </div>
    </section>
  );
}
