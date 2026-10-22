"use client";

import { useEffect, useState } from "react";

const TICK_MS = 1000;

/** The time, ticking once a second, for live ETAs and countdown rings. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(t);
  }, []);
  return now;
}
