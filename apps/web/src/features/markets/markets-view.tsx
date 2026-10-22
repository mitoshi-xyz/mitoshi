"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Skeleton } from "@/kit";
import { useLiveMids, usePerps } from "../hyperliquid/hooks";
import { EventCard } from "../polymarket/event-card";
import { pmMarket } from "../polymarket/pm";
import { usePrices, useTokens } from "../solana/hooks";
import { TokenHeader, TokenRow } from "../solana/token-row";
import { MarketsHero } from "./hero";
import { PerpHeader, PerpRow } from "./perp-row";
import { SectionHead } from "./section";

const EVENTS_ON_HOME = 6;
const PERPS_ON_HOME = 8;
const TOKENS_ON_HOME = 8;
const LIST_STALE_MS = 30_000;
const SKELETONS = 6;

/** Markets: a live hero, then every venue's best, each a click from a private trade. */
export function MarketsView() {
  const events = useQuery({
    queryKey: ["polymarket", "events", "trending"],
    queryFn: () => pmMarket.events("trending"),
    staleTime: LIST_STALE_MS,
  });
  const perps = usePerps();
  const mids = useLiveMids();
  const tokens = useTokens("");
  const [allPerps, setAllPerps] = useState(false);
  const topPerps = useMemo(
    () =>
      [...(perps.data ?? [])]
        .sort((a, b) => b.dayVolumeUsd - a.dayVolumeUsd)
        .slice(0, allPerps ? undefined : PERPS_ON_HOME),
    [perps.data, allPerps],
  );
  const topTokens = (tokens.data ?? []).slice(0, TOKENS_ON_HOME);
  const prices = usePrices(topTokens.map((t) => t.mint));

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="type-headline-lg">Markets</h1>
        <p className="text-ink-2">Polymarket, Hyperliquid and Solana. Every trade from a wallet nobody can follow.</p>
      </div>
      <MarketsHero />

      <section className="flex flex-col gap-4">
        <SectionHead index="01" title="Predictions" venue="polymarket" href="/predict" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {events.isPending
            ? Array.from({ length: SKELETONS }, (_, i) => <Skeleton key={`e-${i}`} className="h-52 rounded-xl" />)
            : (events.data ?? []).slice(0, EVENTS_ON_HOME).map((e) => <EventCard key={e.id} e={e} />)}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead
          index="02"
          title="Perpetuals"
          venue="hyperliquid"
          extra={
            <button
              type="button"
              onClick={() => setAllPerps(!allPerps)}
              className="text-[13px] text-ink-2 hover:text-ink"
            >
              {allPerps ? "Show top 8" : `All ${perps.data?.length ?? ""} perps`}
            </button>
          }
        />
        <div className="flex flex-col">
          <PerpHeader />
          {perps.isPending
            ? Array.from({ length: SKELETONS }, (_, i) => <Skeleton key={`p-${i}`} className="my-1 h-12" />)
            : topPerps.map((p) => <PerpRow key={p.name} perp={p} live={mids[p.name]} />)}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionHead index="03" title="Solana tokens" venue="solana" href="/tokens" />
        <div className="flex flex-col">
          <TokenHeader />
          {tokens.isPending
            ? Array.from({ length: SKELETONS }, (_, i) => <Skeleton key={`t-${i}`} className="my-1 h-12" />)
            : topTokens.map((t) => <TokenRow key={t.mint} t={t} live={prices.data?.[t.mint]} />)}
        </div>
      </section>
    </div>
  );
}
