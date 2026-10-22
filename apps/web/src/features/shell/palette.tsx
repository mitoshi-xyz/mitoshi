"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx, Skeleton } from "@/kit";
import { usePerps } from "../hyperliquid/hooks";
import { Mark, type Venue, VenueMark } from "../marks/mark";
import { pmMarket } from "../polymarket/pm";
import { solMarket } from "../solana/sol";
import { PAGES, PLACES } from "./places";

const SEARCH_DEBOUNCE_MS = 250;
const PER_GROUP = 6;
const MIN_REMOTE_QUERY = 2;

interface Hit {
  key: string;
  label: string;
  hint: string;
  href: string;
  mark: React.ReactNode;
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const venueTag = (venue: Venue) => <VenueMark venue={venue} size={14} className="opacity-80" />;

/** ⌘K: every page and every market on all three venues, one list. Remote searches go over OHTTP. */
export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const query = useDebounced(q.trim(), SEARCH_DEBOUNCE_MS);
  const perps = usePerps();
  const remote = query.length >= MIN_REMOTE_QUERY;
  const events = useQuery({
    queryKey: ["polymarket", "events", `q:${query}`],
    queryFn: () => pmMarket.search(query),
    enabled: open && remote,
  });
  const tokens = useQuery({
    queryKey: ["solana", "tokens", query],
    queryFn: () => solMarket.search(query),
    enabled: open && remote,
  });

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const groups = useMemo(() => {
    const needle = query.toLowerCase();
    const pages: Hit[] = [...PLACES, ...PAGES]
      .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle))
      .map((p) => ({
        key: `page-${p.href}`,
        label: p.name,
        hint: p.description,
        href: p.href,
        mark: <p.icon size={18} className="text-ink-2" />,
      }));
    const perpHits: Hit[] = (perps.data ?? [])
      .filter((p) => needle && p.name.toLowerCase().includes(needle))
      .sort((a, b) => b.dayVolumeUsd - a.dayVolumeUsd)
      .slice(0, PER_GROUP)
      .map((p) => ({
        key: `perp-${p.name}`,
        label: `${p.name}-PERP`,
        hint: `up to ${p.maxLeverage}×`,
        href: `/trade#${p.name}`,
        mark: <Mark symbol={p.name} size={22} />,
      }));
    const eventHits: Hit[] = (remote ? (events.data ?? []) : []).slice(0, PER_GROUP).map((e) => ({
      key: `event-${e.id}`,
      label: e.title,
      hint: "Polymarket",
      href: `/event#${e.id}`,
      mark: <Mark symbol={e.title} src={e.image} size={22} className="rounded-md" />,
    }));
    const tokenHits: Hit[] = (remote ? (tokens.data ?? []) : []).slice(0, PER_GROUP).map((t) => ({
      key: `token-${t.mint}`,
      label: t.symbol,
      hint: t.name,
      href: `/token#${t.mint}`,
      mark: <Mark symbol={t.symbol} src={t.icon} size={22} />,
    }));
    return [
      { title: "Pages", venue: null, hits: needle ? pages : pages.slice(0, PER_GROUP) },
      { title: "Perps", venue: "hyperliquid" as const, hits: perpHits },
      { title: "Predictions", venue: "polymarket" as const, hits: eventHits },
      { title: "Tokens", venue: "solana" as const, hits: tokenHits },
    ].filter((g) => g.hits.length > 0);
  }, [query, perps.data, events.data, tokens.data, remote]);

  const flat = groups.flatMap((g) => g.hits);
  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    onClose();
    router.push(hit.href);
  };

  if (!open) return null;
  const loading = remote && (events.isFetching || tokens.isFetching);
  return (
    <div className="fixed inset-0 z-[var(--z-command)] flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[var(--scrim)]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-strong bg-surface-1 shadow-[var(--shadow-receipt)]"
      >
        <div className="flex items-center gap-3 border-hairline border-b px-4">
          <Search size={18} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, flat.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter") go(flat[active]);
            }}
            placeholder="BTC, an election, a Solana token, a page…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          <kbd className="num rounded-md border border-hairline px-1.5 py-0.5 text-[11px] text-muted">esc</kbd>
        </div>
        <div className="overflow-y-auto p-2">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col py-1">
              <p className="flex items-center gap-1.5 px-2 pt-1 pb-1.5 type-label text-muted">
                {g.venue ? venueTag(g.venue) : null}
                {g.title}
              </p>
              {g.hits.map((h) => {
                const i = flat.indexOf(h);
                return (
                  <button
                    key={h.key}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={cx(
                      "flex items-center gap-3 rounded-lg px-2 py-2 text-left",
                      i === active ? "bg-surface-2" : "",
                    )}
                  >
                    <span className="flex size-7 items-center justify-center">{h.mark}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{h.label}</span>
                    <span className="truncate text-[12px] text-muted">{h.hint}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {loading ? (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-9" label="Searching" />
              <Skeleton className="h-9" />
            </div>
          ) : null}
          {!loading && flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted">Nothing matches “{q}” on any venue.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
