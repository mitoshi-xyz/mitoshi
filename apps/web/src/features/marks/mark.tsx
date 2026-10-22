"use client";

import { proxiedImage } from "@mitoshi/net";
import { useState } from "react";
import { RELAY } from "@/constants";
import { COIN_MARKS, RASTER_MARKS, type VENUE_MARKS } from "./manifest.generated";

export type Venue = (typeof VENUE_MARKS)[number];

const LETTERS = 3;
const DISC_MIN_FONT_PX = 8;
const DISC_FONT_RATIO = 0.34;

/** "kPEPE" (1,000 PEPE on Hyperliquid) wears PEPE's mark. */
const markName = (symbol: string) => (/^k[A-Z]/.test(symbol) ? symbol.slice(1) : symbol).toUpperCase();

function localMark(symbol: string): string | null {
  const s = markName(symbol);
  if (!COIN_MARKS.has(s)) return null;
  return `/marks/${s}.${RASTER_MARKS.has(s) ? "png" : "svg"}`;
}

/** The labelled disc for an asset with no mark: its letters on a quiet surface, never a broken image. */
function Disc({ symbol, size }: { symbol: string; size: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full bg-surface-2 font-mono font-semibold text-ink-2"
      style={{ width: size, height: size, fontSize: Math.max(DISC_MIN_FONT_PX, size * DISC_FONT_RATIO) }}
    >
      {markName(symbol).slice(0, LETTERS)}
    </span>
  );
}

/**
 * An asset's mark: the vendored one when Mitoshi ships it (public/marks), else a picture the venue publishes (through
 * the relay's image proxy, so no image host sees the browser), else a labelled disc.
 */
export function Mark({
  symbol,
  src,
  size = 24,
  className = "",
}: {
  symbol: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = localMark(symbol) ?? (src ? proxiedImage(RELAY, src) : null);
  if (!url || failed) return <Disc symbol={symbol} size={size} />;
  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

const VENUE_NAMES: Record<Venue, string> = {
  hyperliquid: "Hyperliquid",
  solana: "Solana",
  near: "NEAR",
  polygon: "Polygon",
  zcash: "Zcash",
  polymarket: "Polymarket",
  jupiter: "Jupiter",
};

/** A venue's mark (rounded square, as venues show themselves). */
export function VenueMark({ venue, size = 20, className = "" }: { venue: Venue; size?: number; className?: string }) {
  return (
    <img
      src={`/marks/venue-${venue}.svg`}
      alt={VENUE_NAMES[venue]}
      width={size}
      height={size}
      className={`shrink-0 rounded-[28%] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** "on Hyperliquid": the venue badge every row, card and ticket wears. */
export function VenueBadge({ venue }: { venue: Venue }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2 py-0.5 text-ink-2 text-xs">
      <VenueMark venue={venue} size={14} />
      {VENUE_NAMES[venue]}
    </span>
  );
}
