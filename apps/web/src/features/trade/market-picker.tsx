"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ChangeChip, cx, RollingNumber, Segmented, Sheet, Skeleton } from "@/kit";
import { compactUsd, price } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { DRIVERS, PERP_VENUES, useLiveMarks, usePerpMarkets } from "../perps/hooks";
import { CATEGORY_LABEL, type PerpMarket, type PerpVenue } from "../perps/model";

const SKELETON_ROWS = 8;
const PRICE_SIG = 6;
const VENUE_MARK = { hyperliquid: "hyperliquid", pmperps: "polymarket" } as const;

/** The chip that names the market (mark, name, live price, 24h) and opens the picker. */
export function AssetChip({
  market,
  mark,
  change,
  onOpen,
}: {
  market: PerpMarket;
  mark: number;
  change: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-w-0 items-center gap-2.5 rounded-full border border-hairline bg-surface-1/85 py-1.5 pr-3 pl-1.5 backdrop-blur hover:border-strong"
    >
      <span className="relative shrink-0">
        <Mark symbol={market.name} src={market.logo} size={34} />
        <VenueMark
          venue={VENUE_MARK[market.venue]}
          size={14}
          className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface-1"
        />
      </span>
      <span className="flex min-w-0 flex-col items-start leading-tight">
        <span className="flex items-center gap-1.5 font-semibold text-sm">
          <span className="truncate">{market.name}</span>
          <span className="rounded bg-surface-2 px-1 font-mono text-[10px] text-ink-2">{market.maxLeverage}×</span>
        </span>
        <RollingNumber
          value={mark}
          format={{ maximumSignificantDigits: PRICE_SIG }}
          className="font-semibold text-[15px]"
        />
      </span>
      <ChangeChip change={change} />
      <ChevronDown size={16} className="shrink-0 text-muted" />
    </button>
  );
}

function Rows({
  venue,
  q,
  category,
  onPick,
}: {
  venue: PerpVenue;
  q: string;
  category: string;
  onPick: (m: PerpMarket) => void;
}) {
  const markets = usePerpMarkets(venue);
  const marks = useLiveMarks(venue);
  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return (markets.data ?? [])
      .filter(
        (m) => (category === "all" || m.category === category) && (!needle || m.name.toUpperCase().includes(needle)),
      )
      .sort((a, b) => b.dayVolumeUsd - a.dayVolumeUsd);
  }, [markets.data, q, category]);
  if (!markets.data) {
    return Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={`s-${i}`} className="my-1 h-12" />);
  }
  if (rows.length === 0) return <p className="py-8 text-center text-[13px] text-muted">Nothing called “{q}”.</p>;
  return rows.map((m) => {
    const live = marks[m.id] ?? m.markPx;
    const change = m.prevDayPx > 0 ? live / m.prevDayPx - 1 : 0;
    return (
      <li key={m.id}>
        <button
          type="button"
          onClick={() => onPick(m)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-2"
        >
          <Mark symbol={m.name} src={m.logo} size={30} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium text-sm">{m.name}</span>
            <span className="text-[12px] text-muted">
              {compactUsd(m.dayVolumeUsd)} · {m.maxLeverage}×
            </span>
          </span>
          <span className="num text-sm">{price(live)}</span>
          <ChangeChip change={change} />
        </button>
      </li>
    );
  });
}

/** Every perp on both venues: pick the venue, a category, search. */
export function MarketPicker({
  open,
  onClose,
  venue: initial,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  venue: PerpVenue;
  onPick: (m: PerpMarket) => void;
}) {
  const [venue, setVenue] = useState<PerpVenue>(initial);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const markets = usePerpMarkets(venue);
  const categories = useMemo(() => {
    const seen = new Set((markets.data ?? []).map((m) => m.category));
    return ["all", ...["equity", "index", "commodity", "crypto"].filter((c) => seen.has(c))];
  }, [markets.data]);
  return (
    <Sheet open={open} onClose={onClose} title="Markets" wide>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        {PERP_VENUES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setVenue(v);
              setCategory("all");
            }}
            className={cx(
              "flex h-10 items-center justify-center gap-2 rounded-lg font-medium text-sm",
              venue === v ? "bg-surface-1 text-ink shadow-sm" : "text-ink-2 hover:text-ink",
            )}
          >
            <VenueMark venue={VENUE_MARK[v]} size={18} />
            {DRIVERS[v].label}
          </button>
        ))}
      </div>
      <label className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface-2 px-4">
        <Search size={16} className="text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={venue === "pmperps" ? "NVDA, gold, S&P…" : "BTC, ETH, HYPE…"}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      {categories.length > 2 ? (
        <Segmented
          size="sm"
          className="self-start"
          value={category}
          onChange={setCategory}
          options={categories.map((c) => ({ value: c, label: c === "all" ? "All" : (CATEGORY_LABEL[c] ?? c) }))}
        />
      ) : null}
      <ul className="flex min-h-[50dvh] flex-col">
        <Rows
          venue={venue}
          q={q}
          category={category}
          onPick={(m) => {
            onPick(m);
            onClose();
          }}
        />
      </ul>
    </Sheet>
  );
}
