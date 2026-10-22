"use client";

import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "./cx";
import { cue } from "./feedback";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;
const PHONE_QUERY = "(max-width: 767px)";

/** Applies one keypad key to an amount string, never past `decimals` places and never with a leading zero run. */
export function pressKey(value: string, key: string, decimals: number): string {
  if (key === "del") return value.slice(0, -1);
  if (key === ".") return decimals === 0 || value.includes(".") ? value : `${value || "0"}.`;
  const [, frac] = value.split(".");
  if (frac !== undefined && frac.length >= decimals) return value;
  if (value === "0") return key;
  return value + key;
}

/** A phone-sized numeric keypad: digits, a point and delete. The amount stays a string, never a float. */
export function Keypad({ onKey, className }: { onKey: (key: string) => void; className?: string }) {
  return (
    <div className={cx("grid grid-cols-3 gap-1", className)}>
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === "del" ? "Delete" : k}
          onClick={() => {
            cue("tap");
            onKey(k);
          }}
          className="flex h-12 items-center justify-center rounded-xl font-mono font-semibold text-[22px] text-ink transition-colors active:bg-surface-2"
        >
          {k === "del" ? <Delete size={22} className="text-ink-2" /> : k}
        </button>
      ))}
    </div>
  );
}

/** Whether a media query matches now (false before the first paint). */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(query);
    const set = () => setOn(q.matches);
    set();
    q.addEventListener("change", set);
    return () => q.removeEventListener("change", set);
  }, [query]);
  return on;
}

/** Whether the screen is phone-sized (under 768 px), where amounts use the keypad. */
export function usePhone(): boolean {
  return useMedia(PHONE_QUERY);
}
