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
  onChange: (v: number) => void;
}) {
  const [lev, setLev] = useState(value);
  useEffect(() => {
    if (open) setLev(value);
  }, [open, value]);
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
          isolated: market.onlyIsolated,
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
            onChange(lev);
            onClose();
          }}
          className="h-13 w-full rounded-full bg-accent font-semibold text-accent-ink hover:brightness-110"
        >
          Set {lev}×
        </button>
      }
    >
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
        <span className="num font-semibold text-warning">{liq ? price(liq) : "–"}</span>
      </div>
    </Sheet>
  );
}
