"use client";

import { MarketChart } from "@mitoshi/chart";
import { HISTORY, type HistoryRange } from "@mitoshi/venues/polymarket";
import { useEffect, useRef, useState } from "react";
import { pmMarket } from "./pm";

const PCT = 100;
const MS_PER_SECOND = 1000;
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

  useEffect(() => {
    if (!box.current) return;
    const c = new MarketChart(box.current, "line");
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
        chart.current?.setBars(
          points.map((p) => ({ t: p.t * MS_PER_SECOND, o: p.p * PCT, h: p.p * PCT, l: p.p * PCT, c: p.p * PCT })),
        );
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
    chart.current?.push({ t: lastTrade.at, o: v, h: v, l: v, c: v });
  }, [lastTrade]);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-3">
      <div className="flex gap-1 text-sm">
        {(Object.keys(HISTORY) as HistoryRange[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded px-2 py-0.5 ${range === r ? "bg-white/15" : "opacity-60 hover:opacity-100"}`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>
      <div className="relative h-72">
        <div ref={box} className="absolute inset-0" />
        {load === "loading" ? (
          <div
            role="status"
            aria-label="Loading the chart"
            className="absolute inset-0 animate-pulse rounded bg-white/5"
          />
        ) : null}
        {load === "error" ? (
          <p className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
            Could not load the history. Pick another range to retry.
          </p>
        ) : null}
      </div>
    </div>
  );
}
