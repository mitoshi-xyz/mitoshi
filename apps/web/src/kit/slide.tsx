"use client";

import { Check, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { cx } from "./cx";

const RAIL_H = 56;
const THUMB = 48;
const INSET = 4;
const COMMIT = 0.9;

/** Slide to confirm: for moves that cannot be undone (sending ZEC out). Commits past 90 % of the rail. */
export function SlideToConfirm({
  label,
  onConfirm,
  disabled = false,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const max = () => (rail.current?.clientWidth ?? 0) - THUMB - INSET * 2;

  return (
    <div
      ref={rail}
      className={cx(
        "relative w-full select-none overflow-hidden rounded-full bg-accent-wash",
        disabled ? "opacity-40" : "",
      )}
      style={{ height: RAIL_H }}
    >
      <span className="absolute inset-0 flex items-center justify-center pl-10 font-semibold text-[15px] text-accent">
        {done ? "Confirmed" : label}
      </span>
      <span aria-hidden className="absolute inset-y-0 left-0 bg-accent/25" style={{ width: x + THUMB + INSET }} />
      <button
        type="button"
        disabled={disabled || done}
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !done) {
            setDone(true);
            onConfirm();
          }
        }}
        onPointerDown={(e) => {
          if (disabled || done) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          setDrag(e.clientX - x);
        }}
        onPointerMove={(e) => {
          if (drag === null) return;
          setX(Math.min(max(), Math.max(0, e.clientX - drag)));
        }}
        onPointerUp={() => {
          setDrag(null);
          if (x >= max() * COMMIT) {
            setX(max());
            setDone(true);
            onConfirm();
          } else {
            setX(0);
          }
        }}
        className={cx(
          "absolute top-1 left-1 flex items-center justify-center rounded-full bg-accent text-accent-ink shadow-md",
          drag === null
            ? "transition-transform duration-[var(--dur-pill)] [transition-timing-function:var(--ease-out)]"
            : "",
        )}
        style={{ width: THUMB, height: THUMB, transform: `translateX(${x}px)` }}
      >
        {done ? <Check size={22} strokeWidth={3} /> : <ChevronRight size={24} strokeWidth={2.5} />}
      </button>
    </div>
  );
}
