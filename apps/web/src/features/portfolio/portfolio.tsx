"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { useQueries } from "@tanstack/react-query";
import { Eye, EyeOff, History as HistoryIcon, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { cx, EmptyState, RollingNumber, Segmented, Skeleton } from "@/kit";
import { usd } from "../format";
import { VenueMark } from "../marks/mark";
import { openPublicView } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { STATUS, shortAddress } from "../private-wallets/venues";
import { StatusPill } from "../private-wallets/wallet-card";
import { MASK, useHideAmounts } from "../shell/prefs";
import { solMarket } from "../solana/sol";
import { useBooks, type WalletBook, withCostBasis } from "./book";
import { Positions } from "./positions";

const TOKEN_STALE_MS = 300_000;

function Signed({ v, hidden, className }: { v: number | null; hidden: boolean; className?: string }) {
  if (v === null) return <span className={cx("text-muted", className)}>–</span>;
  if (hidden) return <span className={className}>{MASK}</span>;
  return (
    <span className={cx(v >= 0 ? "text-up" : "text-down", className)}>
      {v >= 0 ? "+" : "−"}
      {usd(Math.abs(v))}
    </span>
  );
}

/** A wallet's whole result: what it holds now plus what came home, less what funded it. */
const allTime = (b: WalletBook) => (b.fundedUsd === null ? null : b.valueUsd + b.homeUsd - b.fundedUsd);

function Stat({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-black/25 p-3">
      <span className="text-[12px] text-cream/60">{label}</span>
      <span className="num font-semibold text-[16px]">{children}</span>
      {hint ? <span className="text-[11px] text-cream/45">{hint}</span> : null}
    </div>
  );
}

function WalletRows({ books }: { books: WalletBook[] }) {
  const [hidden] = useHideAmounts();
  if (books.length === 0) {
    return (
      <EmptyState
        icon={WalletCards}
        title="No private wallets yet"
        body="Fund one and its value, P&L and story show up here."
        action={{ label: "Private wallets", href: "/wallets" }}
      />
    );
  }
  return (
    <ul className="flex flex-col">
      {books.map((b) => (
        <li key={b.w.id} className="flex items-center gap-3 border-hairline border-b px-3 py-3 text-[13px]">
          <VenueMark venue={b.w.venue} size={30} />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <button
              type="button"
              onClick={() => openPublicView(b.w.id)}
              className="num inline-flex items-center gap-1 self-start hover:underline"
            >
              {shortAddress(b.w.address)} <Eye size={11} className="text-muted" />
            </button>
            <span className="text-[11px] text-muted">
              {b.error
                ? `Couldn't read it just now: retrying`
                : `funded ${b.fundedUsd === null ? "–" : hidden ? MASK : usd(b.fundedUsd)}`}
            </span>
          </span>
          <StatusPill w={b.w} />
          <span className="num w-24 text-right">
            {b.loading ? <Skeleton className="ml-auto h-4 w-16" /> : hidden ? MASK : usd(b.valueUsd)}
            <Signed v={allTime(b)} hidden={hidden} className="block text-[11px]" />
          </span>
        </li>
      ))}
    </ul>
  );
}

interface Event {
  key: string;
  at: number;
  w: PrivateWallet;
  text: string;
}

function HistoryRows({ wallets }: { wallets: PrivateWallet[] }) {
  const events: Event[] = useMemo(
    () =>
      wallets
        .flatMap((w) => [
          ...w.timeline.map((e) => ({
            key: `${w.id}:t:${e.at}:${e.status}`,
            at: e.at,
            w,
            text: e.note ? `${STATUS[e.status].word} · ${e.note}` : STATUS[e.status].word,
          })),
          ...(w.trades ?? []).map((t) => ({ key: `${w.id}:x:${t.at}:${t.ref ?? ""}`, at: t.at, w, text: t.label })),
        ])
        .sort((a, b) => b.at - a.at),
    [wallets],
  );
  if (events.length === 0) {
    return <EmptyState icon={HistoryIcon} title="Nothing yet" body="Fundings, trades and trips home land here." />;
  }
  return (
    <ul className="flex flex-col">
      {events.map((e) => (
        <li key={e.key} className="flex items-center gap-3 border-hairline border-b px-3 py-2.5 text-[13px]">
          <span className="num w-28 shrink-0 text-[12px] text-muted">
            {new Date(e.at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <VenueMark venue={e.w.venue} size={18} />
          <span className="min-w-0 flex-1 truncate">{e.text}</span>
          <span className="num hidden text-[11px] text-muted sm:block">{shortAddress(e.w.address)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Portfolio: one private view across every venue and wallet, put together only in this browser. */
export function Portfolio() {
  const registry = useRegistry();
  const [hidden, setHidden] = useHideAmounts();
  const [tab, setTab] = useState<"positions" | "wallets" | "history">("positions");
  const books = useBooks(registry.wallets);
  const mints = [...new Set(books.flatMap((b) => b.positions.filter((p) => p.kind === "token").map((p) => p.asset)))];
  const meta = useQueries({
    queries: mints.map((m) => ({
      queryKey: ["solana", "token", m],
      queryFn: () => solMarket.token(m),
      staleTime: TOKEN_STALE_MS,
    })),
  });
  const tokens = Object.fromEntries(mints.map((m, i) => [m, meta[i]?.data]));
  const rows = withCostBasis(
    books.flatMap((b) => b.positions),
    (m) => tokens[m]?.decimals,
  );

  const live = books.filter((b) => b.valueUsd > 0 || b.loading);
  const value = books.reduce((n, b) => n + b.valueUsd, 0);
  const open = rows.reduce((n, r) => n + (r.pnlUsd ?? 0), 0);
  const day = books.some((b) => b.dayPnlUsd !== null) ? books.reduce((n, b) => n + (b.dayPnlUsd ?? 0), 0) : null;
  const known = books.map(allTime).filter((v): v is number => v !== null);
  const total = known.length ? known.reduce((n, v) => n + v, 0) : null;
  const costs = books.reduce((n, b) => n + b.swapCostUsd, 0);
  const loading = books.some((b) => b.loading);

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="type-headline-lg">Portfolio</h1>
        <p className="text-ink-2">Every wallet on every venue, in one view that only this browser can put together.</p>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-[#141210] p-6 text-cream">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-4 -bottom-12 select-none font-stamp text-[180px] text-cream/[0.04] leading-none"
        >
          通
        </span>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-cream/60">
              Value on venues · {live.length} wallet{live.length === 1 ? "" : "s"} · {rows.length} position
              {rows.length === 1 ? "" : "s"}
            </span>
            {hidden ? (
              <span className="num font-semibold text-[44px] leading-tight">{MASK}</span>
            ) : loading && value === 0 ? (
              <Skeleton className="h-12 w-48 bg-cream/10" label="Reading each wallet, privately" />
            ) : (
              <RollingNumber
                value={value}
                format={{ style: "currency", currency: "USD" }}
                className="font-semibold text-[44px] leading-tight"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => setHidden(!hidden)}
            aria-label={hidden ? "Show amounts" : "Hide amounts"}
            className="rounded-full p-2 text-cream/60 hover:bg-cream/10 hover:text-cream"
          >
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Today" hint="Hyperliquid's own 24 h record">
            <Signed v={day} hidden={hidden} />
          </Stat>
          <Stat label="Open P&L" hint="live, at the latest prices">
            <Signed v={rows.length ? open : null} hidden={hidden} />
          </Stat>
          <Stat label="All-time P&L" hint="now + home − funded">
            <Signed v={total} hidden={hidden} />
          </Stat>
          <Stat label="Swap costs" hint="NEAR Intents, in and out">
            {hidden ? MASK : usd(costs)}
          </Stat>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <Segmented
          options={[
            { value: "positions", label: `Positions · ${rows.length}` },
            { value: "wallets", label: `Wallets · ${books.length}` },
            { value: "history", label: "History" },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "positions" ? <Positions rows={rows} loading={loading} tokens={tokens} /> : null}
        {tab === "wallets" ? <WalletRows books={books} /> : null}
        {tab === "history" ? <HistoryRows wallets={registry.wallets} /> : null}
      </section>
    </section>
  );
}
