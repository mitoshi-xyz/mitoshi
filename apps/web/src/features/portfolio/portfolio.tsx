"use client";

import { Eye, WalletCards } from "lucide-react";
import { useState } from "react";
import { EmptyState, Segmented, Skeleton } from "@/kit";
import { usd } from "../format";
import { VenueMark } from "../marks/mark";
import { openPublicView } from "../private-wallets/drawers";
import { shortAddress } from "../private-wallets/venues";
import { StatusPill } from "../private-wallets/wallet-card";
import { MASK, useHideAmounts } from "../shell/prefs";
import { History } from "../wallet/history";
import { SyncStrip } from "../wallet/sync-strip";
import type { WalletState } from "../wallet/wallet-store";
import { YourAssets } from "./assets";
import type { WalletBook } from "./book";
import { MoneyCard, Signed } from "./money-card";
import { Positions } from "./positions";
import { allTime, usePortfolio } from "./totals";

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
 * Portfolio: your money in one private view, put together only in this browser. One total for everything, what it is
 * made of token by token, the open positions moving with the market, then the history and the private wallets.
 */
export function Portfolio({ state }: { state: WalletState }) {
  const [hidden] = useHideAmounts();
  const [tab, setTab] = useState<"history" | "wallets">("history");
  const p = usePortfolio(state);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="type-headline-lg">Portfolio</h1>
      {/* Wide screens: the money on the left, what happened on the right. */}
      <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:items-start xl:gap-8">
        <div className="flex flex-col gap-6">
          <MoneyCard state={state} p={p} />
          <SyncStrip state={state} />
          <YourAssets p={p} state={state} />

          {p.positions.length > 0 ? (
            <section className="flex flex-col gap-1">
              <h2 className="flex items-baseline justify-between px-2 font-semibold text-[15px]">
                Positions · {p.positions.length}
                <span className="num font-normal text-[13px]">
                  <Signed v={p.openPnlUsd} hidden={hidden} />
                </span>
              </h2>
              <Positions rows={p.positions} loading={p.loading} tokens={p.tokens} />
            </section>
          ) : null}
        </div>

        <section className="flex flex-col gap-3">
          <Segmented
            options={[
              { value: "history", label: "History" },
              { value: "wallets", label: `Wallets · ${p.books.length}` },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "wallets" ? <WalletRows books={p.books} /> : null}
          {tab === "history" ? <History entries={state.history} tip={state.summary?.tip ?? null} /> : null}
        </section>
      </div>
    </section>
  );
}
