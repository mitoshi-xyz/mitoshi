"use client";

import { useQueries } from "@tanstack/react-query";
import { Eye, WalletCards } from "lucide-react";
import { useState } from "react";
import { cx, EmptyState, RollingNumber, Segmented, Skeleton } from "@/kit";
import { usd } from "../format";
import { VenueMark } from "../marks/mark";
import { openPublicView } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { shortAddress } from "../private-wallets/venues";
import { StatusPill } from "../private-wallets/wallet-card";
import { MASK, useHideAmounts } from "../shell/prefs";
import { solMarket } from "../solana/sol";
import { History } from "../wallet/history";
import { SyncStrip } from "../wallet/sync-strip";
import type { WalletState } from "../wallet/wallet-store";
import { useBooks, type WalletBook, withCostBasis } from "./book";
import { MoneyCard } from "./money-card";
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

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-surface-2 px-3 py-2.5">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="num font-semibold text-[14px]">{children}</span>
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

/**
 * Portfolio: your money in one private view, put together only in this browser. The shielded balance and the ways in
 * and out, then every private wallet on every venue: value, P&L, positions and history.
 */
export function Portfolio({ state }: { state: WalletState }) {
  const registry = useRegistry();
  const [hidden] = useHideAmounts();
  const [tab, setTab] = useState<"history" | "positions" | "wallets">("history");
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
    <section className="flex flex-col gap-6">
      <h1 className="type-headline-lg">Portfolio</h1>
      <MoneyCard state={state} />
      <SyncStrip state={state} />

      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-ink-2">
            On venues · {live.length} wallet{live.length === 1 ? "" : "s"}
          </span>
          {hidden ? (
            <span className="num font-semibold text-[24px]">{MASK}</span>
          ) : loading && value === 0 ? (
            <Skeleton className="h-7 w-28" label="Reading each wallet, privately" />
          ) : (
            <RollingNumber
              value={value}
              format={{ style: "currency", currency: "USD" }}
              className="font-semibold text-[24px]"
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat label="Today">
            <Signed v={day} hidden={hidden} />
          </Stat>
          <Stat label="Open P&L">
            <Signed v={rows.length ? open : null} hidden={hidden} />
          </Stat>
          <Stat label="All-time">
            <Signed v={total} hidden={hidden} />
          </Stat>
          <Stat label="Swap costs">{hidden ? MASK : usd(costs)}</Stat>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <Segmented
          options={[
            { value: "history", label: "History" },
            { value: "positions", label: `Positions · ${rows.length}` },
            { value: "wallets", label: `Wallets · ${books.length}` },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "positions" ? <Positions rows={rows} loading={loading} tokens={tokens} /> : null}
        {tab === "wallets" ? <WalletRows books={books} /> : null}
        {tab === "history" ? <History entries={state.history} tip={state.summary?.tip ?? null} /> : null}
      </section>
    </section>
  );
}
