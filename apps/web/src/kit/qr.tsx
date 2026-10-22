"use client";

import { encode } from "uqr";

const FINDER = 7;
const DOT_R = 0.5;
const MARK_SHARE = 0.22;
const RING_OUTER = 3.5;
const RING_STROKE = 1;
const RING_INNER = 1.5;
const HALF = 0.5;
const MARK_INSET = 0.6;
const PLATE_PAD = 32;

/**
 * A QR code drawn as dots with rounded finder rings and a mark in the middle, on a light plate so it scans in both
 * themes. Error correction is H, so the hidden centre never costs a scan; dots are a full half-module in radius
 * (smaller dots were found not to decode reliably in Kawase's study).
 */
export function DottedQr({ value, size = 232, mark }: { value: string; size?: number; mark?: string }) {
  const qr = encode(value, { ecc: "H", border: 0 });
  const n = qr.size;
  const center = n / 2;
  const hole = Math.ceil(n * MARK_SHARE);
  const inFinder = (x: number, y: number) =>
    (x < FINDER && y < FINDER) || (x >= n - FINDER && y < FINDER) || (x < FINDER && y >= n - FINDER);
  const inHole = (x: number, y: number) =>
    mark !== undefined && Math.abs(x + HALF - center) < hole * HALF && Math.abs(y + HALF - center) < hole * HALF;
  const dots: string[] = [];
  qr.data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on && !inFinder(x, y) && !inHole(x, y))
        dots.push(
          `M${x + HALF - DOT_R},${y + HALF}a${DOT_R},${DOT_R} 0 1,0 ${DOT_R + DOT_R},0a${DOT_R},${DOT_R} 0 1,0 ${-(DOT_R + DOT_R)},0`,
        );
    });
  });
  const finders: [number, number][] = [
    [RING_OUTER, RING_OUTER],
    [n - RING_OUTER, RING_OUTER],
    [RING_OUTER, n - RING_OUTER],
  ];
  return (
    <div className="inline-flex rounded-xl bg-cream p-4" style={{ width: size + PLATE_PAD }}>
      <svg viewBox={`0 0 ${n} ${n}`} width={size} height={size} role="img" aria-label="QR code of the address">
        <path d={dots.join("")} fill="#141210" />
        {finders.map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <rect
              x={cx - RING_OUTER + RING_STROKE / 2}
              y={cy - RING_OUTER + RING_STROKE / 2}
              width={FINDER - RING_STROKE}
              height={FINDER - RING_STROKE}
              rx={2}
              fill="none"
              stroke="#141210"
              strokeWidth={RING_STROKE}
            />
            <rect
              x={cx - RING_INNER}
              y={cy - RING_INNER}
              width={RING_INNER + RING_INNER}
              height={RING_INNER + RING_INNER}
              rx={0.9}
              fill="#141210"
            />
          </g>
        ))}
        {mark ? (
          <image
            href={mark}
            x={center - hole * HALF + MARK_INSET}
            y={center - hole * HALF + MARK_INSET}
            width={hole - MARK_INSET - MARK_INSET}
            height={hole - MARK_INSET - MARK_INSET}
          />
        ) : null}
      </svg>
    </div>
  );
}
