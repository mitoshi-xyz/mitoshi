"use client";

import type { Levels } from "@mitoshi/chart";
import { readyWallet } from "@mitoshi/engine";
import { useEffect, useState } from "react";
import { cx, Segmented, Skeleton } from "@/kit";
import { compactUsd, funding } from "../format";
import { perpByName, useAccountState, useLiveCtx, useLiveMids, usePerps } from "../hyperliquid/hooks";
import { useRegistry } from "../private-wallets/registry-store";
import { ChartPanel } from "./chart-panel";
import { AssetChip, MarketPicker } from "./market-picker";
import { Positions } from "./positions";
import { Ticket } from "./ticket";
import { WalletCard } from "./wallet-card";

const DEFAULT_COIN = "BTC";

function useHashCoin(): [string, (c: string) => void] {
  const [coin, setCoin] = useState(DEFAULT_COIN);
  useEffect(() => {
    const read = () => setCoin(decodeURIComponent(window.location.hash.slice(1)) || DEFAULT_COIN);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (c: string) => {
    window.location.hash = c;
    setCoin(c);
  };
  return [coin, go];
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={cx("num text-[13px]", tone)}>{value}</span>
    </span>
  );
}

/** The Hyperliquid terminal: the chart is the stage; the ticket and positions sit beside it. */
export function Terminal() {
  const [coin, setCoin] = useHashCoin();
  const perps = usePerps();
  const perp = perpByName(perps.data, coin);
  const ctx = useLiveCtx(coin);
  const mids = useLiveMids();
  const registry = useRegistry();
  const [picker, setPicker] = useState(false);
  const [tab, setTab] = useState<"trade" | "positions">("trade");

  const hl = registry.wallets.filter((w) => w.venue === "hyperliquid");
  const live = hl.filter((w) => w.status === "ready" || w.status === "trading" || w.status === "returning");
  const trading = hl.find((w) => w.status === "trading");
  const tradingState = useAccountState(trading);
  const holdsCoin = tradingState.data?.positions.some((p) => p.coin === coin) ?? false;
  const wallet = holdsCoin ? trading : (readyWallet(registry, "hyperliquid") ?? trading);
  const walletState = useAccountState(wallet);
  const pending = hl.find((w) => w.status === "preparing" || w.status === "funding");

  const position = walletState.data?.positions.find((p) => p.coin === coin);
  const triggers = walletState.data?.orders.filter((o) => o.coin === coin && o.trigger) ?? [];
  const levels: Levels = {
    entry: position?.entryPx ?? null,
    liquidation: position?.liquidationPx ?? null,
    takeProfit: triggers.find((o) => o.trigger?.kind.toLowerCase().includes("take"))?.trigger?.px ?? null,
    stopLoss: triggers.find((o) => o.trigger?.kind.toLowerCase().includes("stop"))?.trigger?.px ?? null,
  };

  const mark = ctx?.markPx ?? mids[coin] ?? perp?.markPx ?? 0;
  const prev = ctx?.prevDayPx ?? perp?.prevDayPx ?? 0;
  const change = prev > 0 ? mark / prev - 1 : 0;
  const positions = live.length;

  return (
    <div className="grid min-h-[calc(100dvh-96px)] grid-cols-[minmax(0,1fr)] lg:h-[calc(100dvh-96px)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="relative flex min-h-[520px] flex-col border-hairline lg:border-r">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-4">
          {perp ? (
            <AssetChip perp={perp} mark={mark} change={change} onOpen={() => setPicker(true)} />
          ) : (
            <Skeleton className="h-12 w-56 rounded-full" label="Loading the market" />
          )}
          {perp ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Stat
                label="Funding / h"
                value={funding(ctx?.funding ?? perp.funding)}
                tone={(ctx?.funding ?? perp.funding) >= 0 ? "text-up" : "text-down"}
              />
              <Stat label="Open interest" value={compactUsd((ctx?.openInterest ?? 0) * mark || perp.openInterestUsd)} />
              <Stat label="24h volume" value={compactUsd(ctx?.dayVolumeUsd ?? perp.dayVolumeUsd)} />
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1">
          <ChartPanel coin={coin} levels={levels} />
        </div>
      </section>
      <aside className="flex flex-col gap-4 overflow-y-auto p-4">
        <WalletCard wallet={wallet} pending={pending} state={walletState.data} loading={walletState.isPending} />
        <Segmented
          className="self-start"
          value={tab}
          onChange={setTab}
          options={[
            { value: "trade", label: "Trade" },
            { value: "positions", label: positions ? `Positions · ${positions}` : "Positions" },
          ]}
        />
        {tab === "trade" ? (
          perp ? (
            <Ticket perp={perp} mark={mark} wallet={wallet} state={walletState.data} />
          ) : (
            <Skeleton className="h-96" label="Loading the ticket" />
          )
        ) : (
          <Positions wallets={live} perps={perps.data ?? []} mids={mids} />
        )}
      </aside>
      <MarketPicker open={picker} onClose={() => setPicker(false)} perps={perps.data} mids={mids} onPick={setCoin} />
    </div>
  );
}
