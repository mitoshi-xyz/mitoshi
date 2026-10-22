"use client";

import type { Perp } from "@mitoshi/venues/hyperliquid";
import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ChangeChip, Drawer, RollingNumber, Skeleton } from "@/kit";
import { compactUsd, price } from "../format";
import { Mark } from "../marks/mark";

const SKELETON_ROWS = 8;
const PRICE_SIG = 6;

/** The chip that names the market and opens the picker. */
export function AssetChip({
  perp,
  mark,
  change,
  onOpen,
}: {
  perp: Perp;
  mark: number;
  change: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 rounded-full border border-hairline bg-surface-1/80 py-1.5 pr-3 pl-1.5 backdrop-blur hover:border-strong"
    >
      <Mark symbol={perp.name} size={34} />
      <span className="flex flex-col items-start leading-tight">
        <span className="flex items-center gap-1.5 font-semibold text-sm">
          {perp.name}-PERP
          <span className="rounded bg-surface-2 px-1 font-mono text-[10px] text-ink-2">{perp.maxLeverage}×</span>
        </span>
        <RollingNumber
          value={mark}
          format={{ maximumSignificantDigits: PRICE_SIG }}
          className="text-[15px] font-semibold"
        />
      </span>
      <ChangeChip change={change} />
      <ChevronDown size={16} className="text-muted" />
    </button>
  );
}

/** Every Hyperliquid perp: search, live price, 24h, volume. */
export function MarketPicker({
  open,
  onClose,
  perps,
  mids,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  perps: Perp[] | undefined;
  mids: Record<string, number>;
  onPick: (coin: string) => void;
}) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return (perps ?? [])
      .filter((p) => !needle || p.name.includes(needle))
      .sort((a, b) => b.dayVolumeUsd - a.dayVolumeUsd);
  }, [perps, q]);
  return (
    <Drawer open={open} onClose={onClose} title="Markets" wide>
      <label className="flex h-11 items-center gap-2 rounded-full border border-hairline bg-surface-2 px-4">
        <Search size={16} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search Hyperliquid perps"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      <ul className="flex flex-col">
        {!perps
          ? Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={`s-${i}`} className="my-1 h-12" />)
          : rows.map((p) => {
              const live = mids[p.name] ?? p.markPx;
              const change = p.prevDayPx > 0 ? live / p.prevDayPx - 1 : 0;
              return (
                <li key={p.name}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p.name);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2"
                  >
                    <Mark symbol={p.name} size={30} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span className="text-[12px] text-muted">
                        {compactUsd(p.dayVolumeUsd)} vol · up to {p.maxLeverage}×
                      </span>
                    </span>
                    <span className="num text-sm">{price(live)}</span>
                    <ChangeChip change={change} />
                  </button>
                </li>
              );
            })}
        {perps && rows.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-muted">No perp called “{q}”.</p>
        ) : null}
      </ul>
    </Drawer>
  );
}
