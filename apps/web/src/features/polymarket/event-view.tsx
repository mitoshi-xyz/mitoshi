"use client";

import { AlertCircle, Clock, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { cx, EmptyState, RollingNumber, Skeleton } from "@/kit";
import { compactUsd } from "../format";
import { Mark, VenueBadge } from "../marks/mark";
import { useEvent, useLiveBook } from "./hooks";
import { OrderBook } from "./order-book";
import { PmTicket } from "./pm-ticket";
import { ProbabilityChart } from "./prob-chart";

const PCT = 100;
const cents = (p: number) => `${Math.round(p * PCT)}¢`;

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

/** One Polymarket event: the question, its outcomes, the chosen outcome's chart and book, the rules, the ticket. */
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

  if (!id)
    return (
      <EmptyState
        icon={AlertCircle}
        title="No event chosen"
        body="Pick one on Predict."
        action={{ label: "Open Predict", href: "/predict" }}
      />
    );
  if (event.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16 w-2/3" label="Loading the event" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }
  if (event.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not load this event"
        body={event.error.message}
        action={{ label: "Try again", onClick: () => void event.refetch() }}
      />
    );
  }

  const e = event.data;
  const chosen = market?.outcomes[outcome];
  const live = lastTrade?.price ?? chosen?.price ?? 0;
  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <Mark symbol={e.title} src={e.image} size={60} className="rounded-xl" />
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="type-heading">{e.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <VenueBadge venue="polymarket" />
            {e.endDate ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={13} /> Ends{" "}
                {new Date(e.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            ) : null}
            <span className="num">{compactUsd(e.volume)} traded</span>
            <span className="num">{compactUsd(e.liquidity)} liquidity</span>
            {e.closed ? <span className="rounded-full bg-surface-2 px-2 py-0.5">Closed</span> : null}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] text-ink-2">
                {market?.title} · {chosen?.label}
              </span>
              <span className="flex items-baseline gap-1.5">
                <RollingNumber
                  value={live * PCT}
                  format={{ maximumFractionDigits: 1 }}
                  suffix="%"
                  className="font-semibold text-[32px]"
                />
                <span className="text-[13px] text-muted">chance</span>
              </span>
            </div>
            {token ? <ProbabilityChart tokenId={token} lastTrade={lastTrade} /> : null}
          </div>

          {e.markets.length > 1 ? (
            <ul className="flex flex-col divide-y divide-[var(--hairline)] overflow-hidden rounded-xl border border-hairline bg-surface-1">
              {e.markets.map((m, i) => {
                const yes = m.outcomes[0];
                const no = m.outcomes[1];
                const p = yes?.price ?? 0;
                return (
                  <li
                    key={m.id}
                    className={cx("flex items-center gap-3 px-4 py-3", i === marketIndex ? "bg-surface-2/60" : "")}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMarketIndex(i);
                        setOutcome(0);
                      }}
                      className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium text-sm">{m.title}</span>
                        <span className="num font-semibold">{Math.round(p * PCT)}%</span>
                      </span>
                      <span className="relative block h-1.5 overflow-hidden rounded-full bg-surface-3">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full bg-accent"
                          style={{ width: `${p * PCT}%` }}
                        />
                      </span>
                    </button>
                    {yes && no ? (
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setMarketIndex(i);
                            setOutcome(0);
                          }}
                          className="h-8 rounded-md border border-up/30 bg-up-wash px-2.5 font-semibold text-[12px] text-up"
                        >
                          Yes {cents(yes.price)}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMarketIndex(i);
                            setOutcome(1);
                          }}
                          className="h-8 rounded-md border border-down/30 bg-down-wash px-2.5 font-semibold text-[12px] text-down"
                        >
                          No {cents(no.price)}
                        </button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2">
            <h2 className="type-title">Order book</h2>
            <OrderBook book={book} />
          </div>

          <details className="group rounded-xl border border-hairline bg-surface-1 p-4">
            <summary className="flex cursor-pointer items-center gap-2 font-medium">
              <ScrollText size={16} className="text-ink-2" /> Rules
            </summary>
            <p className="mt-3 whitespace-pre-wrap text-[14px] text-ink-2">{market?.description || e.description}</p>
            {market?.resolutionSource ? (
              <p className="mt-2 text-[13px] text-muted">Resolution source: {market.resolutionSource}</p>
            ) : null}
          </details>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          {market ? <PmTicket market={market} outcome={outcome} onOutcome={setOutcome} book={book} /> : null}
        </div>
      </div>
    </section>
  );
}
