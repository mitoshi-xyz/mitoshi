"use client";

import type { Levels } from "@mitoshi/chart";
import { latestSwap, readyWallet } from "@mitoshi/engine";
import { useEffect, useMemo, useState } from "react";
import { compactUsd, funding, pct, price, upDown } from "../format";
import { perpByName, useAccountState, useLiveCtx, useLiveMids, usePerps } from "../hyperliquid/hooks";
import { useRegistry } from "../private-wallets/registry-store";
import { ChartPanel } from "./chart-panel";
import { Positions } from "./positions";
import { Ticket } from "./ticket";

const DEFAULT_COIN = "BTC";
const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;

function useHashCoin(): string {
  const read = () => decodeURIComponent(window.location.hash.slice(1)) || DEFAULT_COIN;
  const [coin, setCoin] = useState(DEFAULT_COIN);
  useEffect(() => {
    setCoin(read());
    const on = () => setCoin(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return coin;
}

/** The Hyperliquid terminal: live chart, ticket, and every private wallet's positions. */
export function Terminal() {
  const coin = useHashCoin();
  const perps = usePerps();
  const perp = perpByName(perps.data, coin);
  const ctx = useLiveCtx(coin);
  const mids = useLiveMids();
  const registry = useRegistry();

  const hlWallets = registry.wallets.filter((w) => w.venue === "hyperliquid");
  const live = hlWallets.filter((w) => w.status === "ready" || w.status === "trading" || w.status === "returning");
  const trading = hlWallets.find((w) => w.status === "trading");
  const ready = readyWallet(registry, "hyperliquid");
  const tradingState = useAccountState(trading);
  const holdsCoin = tradingState.data?.positions.some((p) => p.coin === coin) ?? false;
  const wallet = holdsCoin ? trading : (ready ?? undefined);
  const walletState = useAccountState(wallet);

  const pending = hlWallets.find((w) => w.status === "preparing" || w.status === "funding");
  const waiting = useMemo(() => {
    if (!pending) return { text: "No private wallet is ready. Prepare one (or switch on “Keep one ready”)." };
    const swap = latestSwap(pending, "fund");
    if (!swap) return { text: "A private wallet is preparing: funding starts within ~3 min." };
    const left = Math.max(
      1,
      Math.round((swap.createdAt + swap.timeEstimateSeconds * MS_PER_SECOND - Date.now()) / MS_PER_MINUTE),
    );
    return { text: `A private wallet is funding: about ${left} min left.` };
  }, [pending]);

  const position = walletState.data?.positions.find((p) => p.coin === coin);
  const triggers = walletState.data?.orders.filter((o) => o.coin === coin && o.trigger) ?? [];
  const levels: Levels = {
    entry: position?.entryPx ?? null,
    liquidation: position?.liquidationPx ?? null,
    takeProfit: triggers.find((o) => o.trigger?.kind.toLowerCase().includes("take"))?.trigger?.px ?? null,
    stopLoss: triggers.find((o) => o.trigger?.kind.toLowerCase().includes("stop"))?.trigger?.px ?? null,
  };

  const mark = ctx?.markPx ?? perp?.markPx ?? 0;
  const change = ctx && ctx.prevDayPx > 0 ? ctx.markPx / ctx.prevDayPx - 1 : (perp?.change24h ?? 0);

  if (perps.isPending)
    return <div role="status" className="h-96 animate-pulse rounded-xl bg-white/5" aria-label="Loading markets" />;
  if (!perp) {
    return (
      <p className="text-sm opacity-70">
        No Hyperliquid perp called “{coin}”.{" "}
        <a href="/markets" className="underline">
          See all markets
        </a>
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <h2 className="font-semibold text-2xl">{coin}-PERP</h2>
        <span className="font-mono text-xl">{price(mark)}</span>
        <span className={`font-mono text-sm ${upDown(change)}`}>{pct(change)} 24h</span>
        <span className="text-sm opacity-70">Funding {funding(ctx?.funding ?? perp.funding)}/h</span>
        <span className="text-sm opacity-70">
          OI {compactUsd((ctx?.openInterest ?? 0) * mark || perp.openInterestUsd)}
        </span>
        <span className="text-sm opacity-70">Up to {perp.maxLeverage}×</span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <ChartPanel coin={coin} levels={levels} />
        <Ticket perp={perp} mark={mark} wallet={wallet} state={walletState.data} waiting={wallet ? null : waiting} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Your positions</h3>
        <Positions wallets={live} perps={perps.data ?? []} mids={mids} />
      </div>
    </section>
  );
}
