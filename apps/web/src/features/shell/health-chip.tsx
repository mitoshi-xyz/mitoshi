"use client";

import type { LiveStatus } from "@mitoshi/venues/hyperliquid";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveDot } from "@/kit";
import { hlLive } from "../hyperliquid/hl";

/** "Private relay · live": whether live prices are flowing through Mitoshi's relay right now. */
export function HealthChip() {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  useEffect(() => {
    const feed = hlLive();
    const stopStatus = feed.onStatus(setStatus);
    // Keep one tiny public channel open so the chip reflects the relay, whatever the page shows.
    const stopSub = feed.subscribe({ type: "allMids" }, () => undefined);
    return () => {
      stopStatus();
      stopSub();
    };
  }, []);
  return (
    <Link
      href="/status"
      className="inline-flex items-center gap-2 rounded-full border border-hairline px-3 py-1 text-[12px] text-ink-2 hover:border-strong hover:text-ink"
    >
      <LiveDot tone={status === "live" ? "up" : "muted"} />
      {status === "live" ? "Private relay · live" : status === "reconnecting" ? "Reconnecting…" : "Connecting…"}
    </Link>
  );
}
