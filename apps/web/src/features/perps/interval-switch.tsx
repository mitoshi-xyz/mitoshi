"use client";

import { cx } from "@/kit";
import { LIVE_VIEW } from "./use-market-chart";

/** The chart's views as one pill row: Live, then the candle intervals. */
export function IntervalSwitch({
  views,
  view,
  onChange,
  className,
}: {
  views: readonly string[];
  view: string;
  onChange: (view: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-surface-1/80 p-0.5 backdrop-blur [scrollbar-width:none]",
        className,
      )}
    >
      {views.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={view === v}
          className={cx(
            "h-7 shrink-0 rounded-full px-2.5 font-medium text-xs transition-colors",
            view === v ? "bg-ink text-bg" : "text-ink-2 hover:text-ink",
          )}
        >
          {v === LIVE_VIEW ? "Live" : v}
        </button>
      ))}
    </div>
  );
}
