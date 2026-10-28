"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { cx, Sheet } from "@/kit";
import { price } from "../format";
import type { PerpMarket } from "../perps/model";
import { LEVERAGE_PRESETS } from "./constants";
import { liquidationPx } from "./order";

/** Leverage, picked in its own sheet: a big number, presets and a slider, with the liquidation it implies. */
export function LeverageSheet({
  open,
  onClose,
  market,
  value,
  entry,
  isLong,
  margin,
  equity,
  cross,
  locked,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  market: PerpMarket;
  value: number;
  entry: number;
  isLong: boolean;
  /** The order's margin and the wallet's account equity, for where this leverage would be liquidated. */
  margin: number;
  equity: number;
  /** Cross or isolated margin; `locked` when an open position (or the market) has already decided it. */
  cross: boolean;
  locked: boolean;
  onChange: (leverage: number, cross: boolean) => void;
}) {
  const [lev, setLev] = useState(value);
  const [mode, setMode] = useState<"isolated" | "cross">(cross ? "cross" : "isolated");
  useEffect(() => {
    if (open) {
      setLev(value);
      setMode(cross ? "cross" : "isolated");
    }
  }, [open, value, cross]);
  const max = market.maxLeverage;
  const presets = LEVERAGE_PRESETS.filter((p) => p < max);
  const clamp = (v: number) => Math.min(max, Math.max(1, Math.round(v)));
  const liq =
    entry > 0
      ? liquidationPx({
          entry,
          size: (margin * lev) / entry,
          leverage: lev,
          maxLeverage: max,
          isLong,
          equity,
          isolated: market.onlyIsolated || mode === "isolated",
        })
      : null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Leverage"
      footer={
        <button
          type="button"
          onClick={() => {
            onChange(lev, mode === "cross");
            onClose();
          }}
          className="h-13 w-full rounded-full bg-accent font-semibold text-accent-ink hover:brightness-110"
        >
          Set {lev}× · {mode === "cross" ? "Cross" : "Isolated"}
        </button>
      }
    >
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Margin">
          {(["isolated", "cross"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={locked}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cx(
                "h-10 rounded-lg font-medium text-[14px] disabled:cursor-not-allowed",
                mode === m ? "bg-surface-1 text-ink shadow-sm" : "text-ink-2 hover:text-ink disabled:opacity-40",
              )}
            >
              {m === "isolated" ? "Isolated" : "Cross"}
            </button>
          ))}
        </div>
        <p className="text-center text-[12px] text-muted">
          {mode === "isolated" ? "Only this margin is at risk" : "The whole wallet backs it"}
          {locked ? (market.onlyIsolated ? " · this market is isolated only" : " · set by your open position") : ""}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <button
          type="button"
          aria-label="Less leverage"
          onClick={() => setLev(clamp(lev - 1))}
          className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-surface-3"
        >
          <Minus size={20} />
        </button>
        <span className="num font-semibold text-[56px] leading-none">{lev}×</span>
        <button
          type="button"
          aria-label="More leverage"
          onClick={() => setLev(clamp(lev + 1))}
          className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-surface-3"
        >
          <Plus size={20} />
        </button>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        value={lev}
        onChange={(e) => setLev(Number(e.target.value))}
        aria-label="Leverage"
        className="w-full accent-[var(--accent)]"
      />
      <div className="flex flex-wrap gap-1.5">
        {[...presets, max].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setLev(p)}
            className={cx(
              "num h-9 min-w-12 rounded-full px-3 text-[13px] font-medium",
              lev === p ? "bg-ink text-bg" : "bg-surface-2 text-ink-2 hover:text-ink",
            )}
          >
            {p === max ? `Max ${max}×` : `${p}×`}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-[14px]">
        <span className="text-ink-2">Liquidation ≈</span>
        <span className="num font-semibold text-warning">{liq ? price(liq) : margin > 0 ? "none" : "–"}</span>
      </div>
    </Sheet>
  );
}
