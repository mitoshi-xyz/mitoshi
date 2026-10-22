"use client";

import { useEffect, useState } from "react";
import { cx, Sheet } from "@/kit";
import { price, usd } from "../format";
import { SL_PRESETS, TP_PRESETS } from "./constants";
import { priceForReturn } from "./order";

/** Preset prices keep six significant digits; a typed price matches a preset within this share. */
const PRESET_SIG = 6;
const PRESET_MATCH = 1e-6;

function Exit({
  label,
  tone,
  value,
  onValue,
  presets,
  sign,
  entry,
  leverage,
  isLong,
  pnlAt,
}: {
  label: string;
  tone: "up" | "down";
  value: string;
  onValue: (v: string) => void;
  presets: readonly number[];
  sign: 1 | -1;
  entry: number;
  leverage: number;
  isLong: boolean;
  pnlAt: (px: number) => number;
}) {
  const px = Number(value);
  const pnl = value && px > 0 ? pnlAt(px) : null;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <span className={cx("font-semibold text-[15px]", tone === "up" ? "text-up" : "text-down")}>{label}</span>
        <span className={cx("num text-[14px]", pnl === null ? "text-muted" : pnl >= 0 ? "text-up" : "text-down")}>
          {pnl === null ? "off" : `${pnl >= 0 ? "+" : ""}${usd(pnl)}`}
        </span>
      </div>
      <input
        inputMode="decimal"
        placeholder={`Price · now ${price(entry)}`}
        value={value}
        onChange={(e) => onValue(e.target.value)}
        className="h-12 w-full rounded-xl border border-hairline bg-surface-2 px-4 font-mono text-[16px] outline-none focus:border-strong"
      />
      <div className="grid grid-cols-5 gap-1.5">
        {presets.map((p) => {
          const target = priceForReturn(entry, leverage, isLong, sign * p);
          const on = value !== "" && Math.abs(Number(value) - target) / target < PRESET_MATCH;
          return (
            <button
              key={p}
              type="button"
              disabled={!(entry > 0)}
              onClick={() => onValue(String(Number(target.toPrecision(PRESET_SIG))))}
              className={cx(
                "num h-9 rounded-full text-[13px]",
                on ? (tone === "up" ? "bg-up text-bg" : "bg-down text-bg") : "bg-surface-2 text-ink-2 hover:text-ink",
              )}
            >
              {sign > 0 ? "+" : "−"}
              {p}%
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onValue("")}
          className="h-9 rounded-full bg-surface-2 text-[13px] text-ink-2 hover:text-ink"
        >
          Off
        </button>
      </div>
    </section>
  );
}

/** Take profit and stop loss in their own sheet: a price, or a return on the margin, with the PnL it locks in. */
export function ExitsSheet({
  open,
  onClose,
  tp,
  sl,
  entry,
  leverage,
  isLong,
  pnlAt,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  tp: string;
  sl: string;
  entry: number;
  leverage: number;
  isLong: boolean;
  pnlAt: (px: number) => number;
  onChange: (tp: string, sl: string) => void;
}) {
  const [t, setT] = useState(tp);
  const [s, setS] = useState(sl);
  useEffect(() => {
    if (!open) return;
    setT(tp);
    setS(sl);
  }, [open, tp, sl]);
  const tpWrong = t !== "" && (isLong ? Number(t) <= entry : Number(t) >= entry);
  const slWrong = s !== "" && (isLong ? Number(s) >= entry : Number(s) <= entry);
  const wrong = tpWrong
    ? `Take profit must be ${isLong ? "above" : "below"} ${price(entry)}`
    : slWrong
      ? `Stop loss must be ${isLong ? "below" : "above"} ${price(entry)}`
      : null;
  const common = { entry, leverage, isLong, pnlAt };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Take profit · Stop loss"
      footer={
        <div className="flex flex-col gap-2">
          {wrong ? <p className="text-center text-[13px] text-warning">{wrong}</p> : null}
          <button
            type="button"
            disabled={wrong !== null}
            onClick={() => {
              onChange(t.trim(), s.trim());
              onClose();
            }}
            className="h-13 w-full rounded-full bg-accent font-semibold text-accent-ink hover:brightness-110 disabled:opacity-40"
          >
            {t || s ? "Set exits" : "No exits"}
          </button>
        </div>
      }
    >
      <Exit label="Take profit" tone="up" value={t} onValue={setT} presets={TP_PRESETS} sign={1} {...common} />
      <Exit label="Stop loss" tone="down" value={s} onValue={setS} presets={SL_PRESETS} sign={-1} {...common} />
    </Sheet>
  );
}
