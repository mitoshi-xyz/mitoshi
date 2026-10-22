"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { cx } from "./cx";

const PCT = 100;

/** A figure whose digits roll when it changes (260 ms, Mitoshi's ease-out). Always mono, tabular. */
export function RollingNumber({
  value,
  format,
  className,
  prefix,
  suffix,
}: {
  value: number;
  format?: Format;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <NumberFlow
      value={Number.isFinite(value) ? value : 0}
      {...(format ? { format } : {})}
      {...(prefix ? { prefix } : {})}
      {...(suffix ? { suffix } : {})}
      transformTiming={{ duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      spinTiming={{ duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
      className={cx("num", className)}
    />
  );
}

/** "↑ +2.34%": a change in direction colour. */
export function ChangeChip({ change, suffix = "" }: { change: number; suffix?: string }) {
  const up = change >= 0;
  return (
    <span
      className={cx(
        "num inline-flex items-center rounded-full px-2 py-0.5 text-xs",
        up ? "bg-up-wash text-up" : "bg-down-wash text-down",
      )}
    >
      {up ? "↑" : "↓"} {up ? "+" : ""}
      {(change * PCT).toFixed(2)}%{suffix}
    </span>
  );
}

const SPARK_W = 96;
const SPARK_H = 28;

/** A tiny line of recent prices, coloured by direction. */
export function Sparkline({
  points,
  width = SPARK_W,
  height = SPARK_H,
}: {
  points: number[];
  width?: number;
  height?: number;
}) {
  if (points.length < 2) return <span style={{ width, height }} className="inline-block" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - ((p - min) / span) * height).toFixed(1)}`,
    )
    .join(" ");
  const up = (points.at(-1) ?? 0) >= (points[0] ?? 0);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const RING_STROKE = 3;

/** Time left as a draining ring (fundings, swaps, quotes). */
export function CountdownRing({
  fraction,
  size = 28,
  tone = "accent",
}: {
  fraction: number;
  size?: number;
  tone?: "accent" | "up";
}) {
  const r = (size - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={RING_STROKE} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone === "up" ? "var(--up)" : "var(--accent)"}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - f)}
        className="transition-[stroke-dashoffset] duration-1000 ease-linear"
      />
    </svg>
  );
}
