"use client";

import { useEffect, useState } from "react";
import { compactUsd } from "../format";
import { useEvent, useLiveBook } from "./hooks";
import { OrderBook } from "./order-book";
import { pmImage } from "./pm";
import { PmTicket } from "./pm-ticket";
import { ProbabilityChart } from "./prob-chart";

const PCT = 100;

function useHashId(): string {
  const [id, setId] = useState("");
  useEffect(() => {
    const read = () => setId(decodeURIComponent(window.location.hash.slice(1)));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return id;
}

/** One Polymarket event: its outcomes, the chosen outcome's chart and book, the rules, the ticket. */
export function EventView() {
  const id = useHashId();
  const event = useEvent(id);
  const [marketIndex, setMarketIndex] = useState(0);
  const [outcome, setOutcome] = useState(0);
  const market = event.data?.markets[marketIndex];
  const token = market?.outcomes[outcome]?.tokenId;
  const { book, lastTrade } = useLiveBook(token);

  useEffect(() => {
    setMarketIndex(0);
    setOutcome(0);
  }, [id]);

  if (!id) return <p className="opacity-70">Pick a market on the Markets screen.</p>;
  if (event.isPending)
    return <div role="status" aria-label="Loading the market" className="h-96 animate-pulse rounded-xl bg-white/5" />;
  if (event.isError) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-red-400">Could not load this market: {event.error.message}</span>
        <button type="button" className="underline" onClick={() => void event.refetch()}>
          Retry
        </button>
      </div>
    );
  }
  const e = event.data;
  const img = pmImage(e.image);
  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-start gap-4">
        {img ? <img src={img} alt="" className="size-14 rounded-lg object-cover" /> : null}
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-2xl leading-tight">{e.title}</h2>
          <p className="text-sm opacity-60">
            {compactUsd(e.volume)} traded · {compactUsd(e.liquidity)} liquidity
            {e.endDate ? ` · ends ${new Date(e.endDate).toLocaleString()}` : ""}
            {e.closed ? " · closed" : ""}
          </p>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {token ? <ProbabilityChart tokenId={token} lastTrade={lastTrade} /> : null}
          {e.markets.length > 1 ? (
            <ul className="flex flex-col divide-y divide-white/5 rounded-xl border border-white/10">
              {e.markets.map((m, i) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMarketIndex(i);
                      setOutcome(0);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${i === marketIndex ? "bg-white/5" : ""}`}
                  >
                    <span>{m.title}</span>
                    <span className="font-mono">{Math.round((m.outcomes[0]?.price ?? 0) * PCT)}%</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-col gap-2">
            <h3 className="font-medium">
              Order book · {market?.title} · {market?.outcomes[outcome]?.label}
            </h3>
            <OrderBook book={book} />
          </div>
          <details className="rounded-xl border border-white/10 p-4 text-sm">
            <summary className="cursor-pointer font-medium">Rules</summary>
            <p className="mt-2 whitespace-pre-wrap opacity-80">{market?.description || e.description}</p>
            {market?.resolutionSource ? (
              <p className="mt-2 opacity-60">Resolution source: {market.resolutionSource}</p>
            ) : null}
          </details>
        </div>
        {market ? <PmTicket market={market} outcome={outcome} onOutcome={setOutcome} book={book} /> : null}
      </div>
    </section>
  );
}
