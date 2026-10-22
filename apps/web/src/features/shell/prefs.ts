"use client";

import { useSyncExternalStore } from "react";

const HIDE_KEY = "mitoshi-hide-amounts";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether amounts are masked on screen (for screen-sharing and over-the-shoulder privacy). Kept on this device. */
export function useHideAmounts(): [boolean, (v: boolean) => void] {
  const hidden = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
  const set = (v: boolean) => {
    try {
      localStorage.setItem(HIDE_KEY, v ? "1" : "0");
    } catch {
      // Storage blocked: masking lasts until reload.
    }
    for (const l of listeners) l();
  };
  return [hidden, set];
}

export const MASK = "••••";
