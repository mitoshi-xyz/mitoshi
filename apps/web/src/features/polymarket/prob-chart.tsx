"use client";

import { MarketChart } from "@mitoshi/chart";
import { HISTORY, type HistoryRange } from "@mitoshi/venues/polymarket";
import { useEffect, useRef, useState } from "react";
import { ChartLoading } from "@/kit";
import { pmMarket } from "./pm";

const PCT = 100;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const RANGE_LABELS: Record<HistoryRange, string> = {
  "1h": "1H",
  "6h": "6H",
  "1d": "1D",
  "1w": "1W",
  "1m": "1M",
  all: "All",
};

/** An outcome's probability over time, extended live by each trade. */
export function ProbabilityChart({
  tokenId,
  lastTrade,
}: {
  tokenId: string;
  lastTrade: { price: number; at: number } | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<MarketChart | null>(null);
  const [range, setRange] = useState<HistoryRange>("1w");
  const [load, setLoad] = useState<"loading" | "ready" | "error">("loading");
  /** The newest point's time: a live trade folds into it, or into the range's next bucket. */
  const tail = useRef(0);

  useEffect(() => {
    if (!box.current) return;
    const c = new MarketChart(box.current, { mode: "line", format: (v) => `${v.toFixed(1)}%`, watermark: "見通し" });
    chart.current = c;
    return () => {
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setLoad("loading");
    pmMarket.history(tokenId, range).then(
      (points) => {
        if (!current) return;
        const bars = points.map((p) => ({
          t: p.t * MS_PER_SECOND,
          o: p.p * PCT,
          h: p.p * PCT,
          l: p.p * PCT,
          c: p.p * PCT,
        }));
        tail.current = bars.at(-1)?.t ?? 0;
        chart.current?.setBars(bars, true);
        setLoad("ready");
      },
      () => current && setLoad("error"),
    );
    return () => {
      current = false;
    };
  }, [tokenId, range]);

  useEffect(() => {
    if (!lastTrade) return;
    const v = lastTrade.price * PCT;
    // One point per bucket, as the history has: a month of 3-hour points does not gain one per trade.
    const bucket = HISTORY[range].fidelity * MS_PER_MINUTE;
    const t = Math.max(Math.floor(lastTrade.at / bucket) * bucket, tail.current);
    tail.current = t;
    chart.current?.pushBar({ t, o: v, h: v, l: v, c: v });
    // A new range reloads the history; only a new trade moves the line.
  }, [lastTrade]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-0.5 self-start rounded-full bg-surface-2 p-0.5 text-xs">
        {(Object.keys(HISTORY) as HistoryRange[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`h-7 rounded-full px-3 font-medium ${range === r ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="relative h-72">
        <div ref={box} className="absolute inset-0" />
        {load === "loading" ? <ChartLoading verb="Loading the odds history, privately" /> : null}
        {load === "error" ? (
          <p className="absolute inset-0 flex items-center justify-center text-down text-sm">
            Could not load the history. Pick another range to retry.
          </p>
        ) : null}
      </div>
    </div>
  );
}
