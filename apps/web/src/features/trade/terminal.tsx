"use client";

import type { Levels } from "@mitoshi/chart";
import { type PrivateWallet, readyWallet } from "@mitoshi/engine";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Layers } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cue, cx, Segmented, Sheet, Skeleton, useMedia, usePhone } from "@/kit";
import { compactUsd, funding, usd } from "../format";
import { DRIVERS, useLiveMarks, useLiveStats, usePerpAccount, usePerpMarkets } from "../perps/hooks";
import { type PerpMarket, type PerpVenue, parseTerminalHash, terminalHref } from "../perps/model";
import { useRegistry } from "../private-wallets/registry-store";
import { WalletChip } from "../private-wallets/wallet-chip";
import { ChartPanel } from "./chart-panel";
import { AssetChip, MarketPicker } from "./market-picker";
import { useOrder } from "./order";
import { Positions } from "./positions";
import { Ticket } from "./ticket";

const DEFAULT_COIN = "BTC";
/** From here the ticket sits beside the chart; below it, trading opens in sheets. */
const WIDE = "(min-width: 1024px)";
const LIVE = new Set(["ready", "trading", "returning"]);

function useHashMarket(): [{ venue: PerpVenue; id: string }, (m: { venue: PerpVenue; id: string }) => void] {
  const [at, setAt] = useState<{ venue: PerpVenue; id: string }>({ venue: "hyperliquid", id: DEFAULT_COIN });
  useEffect(() => {
    const read = () => setAt(parseTerminalHash(window.location.hash, DEFAULT_COIN));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (m: { venue: PerpVenue; id: string }) => {
    window.history.replaceState(null, "", terminalHref(m));
    setAt(m);
  };
  return [at, go];
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={cx("num text-[13px]", tone)}>{value}</span>
    </span>
  );
}

/** Which wallet trades here: one already holding this market, else a fresh ready one, else the one trading. */
function useTradingWallet(venue: PerpVenue, marketId: string) {
  const driver = DRIVERS[venue];
  const registry = useRegistry();
  const mine = registry.wallets.filter(
    (w) => w.venue === driver.wallet && (venue === "hyperliquid" || w.perps !== undefined || w.status === "ready"),
  );
  const live = mine.filter((w) => LIVE.has(w.status) && (venue === "hyperliquid" || w.perps !== undefined));
  const trading = live.find((w) => w.status === "trading");
  const tradingAccount = usePerpAccount(venue, trading);
  const holds = tradingAccount.data?.positions.some((p) => p.marketId === marketId) ?? false;
  const fresh = readyWallet(registry, driver.wallet);
  const freshUnused = fresh && (fresh.trades ?? []).length === 0 ? fresh : undefined;
  const wallet: PrivateWallet | undefined = holds ? trading : (freshUnused ?? trading);
  const pending = registry.wallets.find(
    (w) => w.venue === driver.wallet && (w.status === "preparing" || w.status === "funding"),
  );
  return { wallet, pending, live };
}

/** The perps terminal, for Hyperliquid and Polymarket Perps: the chart is the stage; trading lives beside it or in sheets. */
export function Terminal() {
  const [at, go] = useHashMarket();
  const driver = DRIVERS[at.venue];
  const markets = usePerpMarkets(at.venue);
  const market = markets.data?.find((m) => m.id === at.id);
  const marks = useLiveMarks(at.venue, [at.id]);
  const stats = useLiveStats(market);
  const { wallet, pending, live } = useTradingWallet(at.venue, at.id);
  const account = usePerpAccount(at.venue, wallet);
  const [order, setOrder] = useOrder(market);
  const phone = usePhone();
  const wide = useMedia(WIDE);
  const [picker, setPicker] = useState(false);
  const [sheet, setSheet] = useState<"order" | "positions" | null>(null);
  const [tab, setTab] = useState<"trade" | "positions">("trade");

  const levels: Levels = useMemo(() => {
    const position = account.data?.positions.find((p) => p.marketId === at.id);
    const triggers = account.data?.orders.filter((o) => o.marketId === at.id && o.trigger) ?? [];
    return {
      entry: position?.entryPx ?? null,
      liquidation: position?.liquidationPx ?? null,
      takeProfit: triggers.find((o) => o.trigger?.kind === "tp")?.trigger?.px ?? null,
      stopLoss: triggers.find((o) => o.trigger?.kind === "sl")?.trigger?.px ?? null,
    };
  }, [account.data, at.id]);

  const mark = stats?.markPx ?? marks[at.id] ?? market?.markPx ?? 0;
  const prev = stats?.prevDayPx ?? market?.prevDayPx ?? 0;
  const change = prev > 0 ? mark / prev - 1 : 0;
  const count = live.length;
  const pick = (m: PerpMarket) => go({ venue: m.venue, id: m.id });
  const openOrder = (side: "long" | "short") => {
    cue("tap");
    setOrder({ side });
    setSheet("order");
  };

  if (markets.isSuccess && !market) {
    return (
      <div className="flex h-[calc(100dvh-160px)] flex-col items-center justify-center gap-3 md:h-[calc(100dvh-88px)]">
        <p className="text-ink-2">
          {at.id} is not listed on {driver.label}.
        </p>
        <button
          type="button"
          onClick={() => setPicker(true)}
          className="h-10 rounded-full bg-accent px-5 font-semibold text-accent-ink"
        >
          Pick a market
        </button>
        <MarketPicker open={picker} onClose={() => setPicker(false)} venue={at.venue} onPick={pick} />
      </div>
    );
  }

  const ticket = (inSheet: boolean) =>
    market ? (
      <Ticket
        market={market}
        mark={mark}
        wallet={wallet}
        account={account.data}
        order={order}
        setOrder={setOrder}
        keypad={inSheet && phone}
        sideInHeader={inSheet}
        onPlaced={() => setSheet(null)}
      />
    ) : (
      <Skeleton className="h-96" label="Loading the ticket" />
    );
  const positions = <Positions venue={at.venue} wallets={live} markets={markets.data ?? []} marks={marks} />;

  return (
    <div className="grid h-[calc(100dvh-160px)] grid-cols-[minmax(0,1fr)] md:h-[calc(100dvh-88px)] lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="relative flex min-h-0 flex-col lg:border-hairline lg:border-r">
        <div className="flex items-start justify-between gap-3 px-3 pt-3">
          {market ? (
            <AssetChip market={market} mark={mark} change={change} onOpen={() => setPicker(true)} />
          ) : (
            <Skeleton className="h-12 w-56 rounded-full" label="Loading the market" />
          )}
          {market ? (
            <div className="hidden flex-wrap gap-x-6 gap-y-2 pt-1.5 xl:flex">
              <Stat
                label="Funding / h"
                value={funding(stats?.funding ?? market.funding)}
                tone={(stats?.funding ?? market.funding) >= 0 ? "text-up" : "text-down"}
              />
              <Stat label="Open interest" value={compactUsd(stats?.openInterestUsd ?? market.openInterestUsd)} />
              <Stat label="24h volume" value={compactUsd(stats?.dayVolumeUsd ?? market.dayVolumeUsd)} />
            </div>
          ) : null}
          <WalletChip
            venue={driver.wallet}
            wallet={wallet}
            pending={pending}
            value={account.data ? usd(account.data.free) : undefined}
            loading={account.isPending}
            className="lg:hidden"
          />
        </div>
        <div className="min-h-0 flex-1">{market ? <ChartPanel market={market} levels={levels} /> : null}</div>
        <footer className="flex flex-col gap-2 px-3 pt-2 pb-3 lg:hidden">
          {count > 0 ? (
            <button
              type="button"
              onClick={() => setSheet("positions")}
              className="flex h-11 items-center gap-3 rounded-full bg-surface-1/85 pr-3 pl-1.5 backdrop-blur"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                <Layers size={15} />
              </span>
              <span className="flex-1 text-left font-semibold text-[14px]">
                {count === 1 ? "View position" : `View ${count} wallets`}
              </span>
              <ChevronRight size={16} className="text-muted" />
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={!market}
              onClick={() => openOrder("long")}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-up font-extrabold text-bg text-[16px] tracking-[0.06em] active:scale-[0.98] disabled:opacity-40"
            >
              <ArrowUpRight size={20} strokeWidth={3} /> LONG
            </button>
            <button
              type="button"
              disabled={!market}
              onClick={() => openOrder("short")}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-down font-extrabold text-bg text-[16px] tracking-[0.06em] active:scale-[0.98] disabled:opacity-40"
            >
              <ArrowDownRight size={20} strokeWidth={3} /> SHORT
            </button>
          </div>
        </footer>
      </section>

      <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto p-4 lg:flex">
        <div className="flex items-center justify-between gap-2">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "trade", label: "Trade" },
              { value: "positions", label: count ? `Positions · ${count}` : "Positions" },
            ]}
          />
          <WalletChip
            venue={driver.wallet}
            wallet={wallet}
            pending={pending}
            value={account.data ? usd(account.data.free) : undefined}
            loading={account.isPending}
          />
        </div>
        {wide ? (tab === "trade" ? ticket(false) : positions) : null}
      </aside>

      <Sheet
        open={sheet === "order" && !wide}
        onClose={() => setSheet(null)}
        title={
          <span className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5 text-[14px]">
            {(["long", "short"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setOrder({ side: s })}
                className={cx(
                  "h-8 rounded-full px-4 font-semibold capitalize",
                  order.side === s ? (s === "long" ? "bg-up text-bg" : "bg-down text-bg") : "text-ink-2",
                )}
              >
                {s} {market?.name}
              </button>
            ))}
          </span>
        }
      >
        {wide ? null : ticket(true)}
      </Sheet>
      <Sheet open={sheet === "positions" && !wide} onClose={() => setSheet(null)} title="Positions">
        {positions}
      </Sheet>
      <MarketPicker open={picker} onClose={() => setPicker(false)} venue={at.venue} onPick={pick} />
    </div>
  );
}
