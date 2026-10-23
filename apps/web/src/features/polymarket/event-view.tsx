"use client";

import type { PmMarket } from "@mitoshi/venues/polymarket";
import { AlertCircle, Clock, ScrollText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cx, EmptyState, RollingNumber, Sheet, Skeleton, useMedia, usePhone } from "@/kit";
import { compactUsd } from "../format";
import { Mark, VenueBadge } from "../marks/mark";
import { useEvent, useLiveBook } from "./hooks";
import { OrderBook } from "./order-book";
import { PmTicket } from "./pm-ticket";
import { ProbabilityChart } from "./prob-chart";

const PCT = 100;
const cents = (p: number) => `${Math.round(p * PCT)}¢`;
/** Outcomes shown on the page; the rest open in a sheet. */
const TOP_OUTCOMES = 4;
/** From here the ticket sits beside the event; below it, it opens in a sheet. */
const WIDE = "(min-width: 1024px)";

/** One outcome row: its chance as a bar, and Yes / No at their prices. */
function OutcomeRow({ m, active, onPick }: { m: PmMarket; active: boolean; onPick: (outcome: number) => void }) {
  const yes = m.outcomes[0];
  const no = m.outcomes[1];
  const p = yes?.price ?? 0;
  return (
    <li className={cx("flex items-center gap-3 px-4 py-3", active ? "bg-surface-2/60" : "")}>
      <button type="button" onClick={() => onPick(0)} className="flex min-w-0 flex-1 flex-col gap-1.5 text-left">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium text-sm">{m.title}</span>
          <span className="num font-semibold">{Math.round(p * PCT)}%</span>
        </span>
        <span className="relative block h-1.5 overflow-hidden rounded-full bg-surface-3">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${p * PCT}%` }} />
        </span>
      </button>
      {yes && no ? (
        <span className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => onPick(0)}
            className="h-8 rounded-md border border-up/30 bg-up-wash px-2.5 font-semibold text-[12px] text-up"
          >
            Yes {cents(yes.price)}
          </button>
          <button
            type="button"
            onClick={() => onPick(1)}
            className="h-8 rounded-md border border-down/30 bg-down-wash px-2.5 font-semibold text-[12px] text-down"
          >
            No {cents(no.price)}
          </button>
        </span>
      ) : null}
    </li>
  );
}

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
  const wide = useMedia(WIDE);
  const phone = usePhone();
  const [sheet, setSheet] = useState<"ticket" | "outcomes" | null>(null);
  /** The chart's heading names the market; the pinned Yes/No bar repeats the name only once it is off screen. */
  const [heading, setHeading] = useState<HTMLElement | null>(null);
  const [headingSeen, setHeadingSeen] = useState(true);
  useEffect(() => {
    if (!heading) return;
    const io = new IntersectionObserver(([entry]) => setHeadingSeen(entry?.isIntersecting ?? true));
    io.observe(heading);
    return () => io.disconnect();
  }, [heading]);
  const [q, setQ] = useState("");
  const ranked = useMemo(
    () =>
      (event.data?.markets ?? [])
        .map((m, i) => ({ m, i }))
        // Live markets first (by chance), resolved ones after.
        .sort(
          (a, b) =>
            Number(b.m.acceptingOrders && !b.m.closed) - Number(a.m.acceptingOrders && !a.m.closed) ||
            (b.m.outcomes[0]?.price ?? 0) - (a.m.outcomes[0]?.price ?? 0),
        ),
    [event.data],
  );

  // A new event opens on its most likely live outcome.
  const first = ranked[0]?.i ?? 0;
  const loadedId = event.data?.id;
  useEffect(() => {
    setMarketIndex(first);
    setOutcome(0);
  }, [id, loadedId]);

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
  const pickOutcome = (i: number, o: number) => {
    setMarketIndex(i);
    setOutcome(o);
    setSheet(wide ? null : "ticket");
  };
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
            <div ref={setHeading} className="flex flex-wrap items-baseline justify-between gap-2">
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
            <div className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface-1">
              <ul className="flex flex-col divide-y divide-[var(--hairline)]">
                {ranked.slice(0, TOP_OUTCOMES).map(({ m, i }) => (
                  <OutcomeRow key={m.id} m={m} active={i === marketIndex} onPick={(o) => pickOutcome(i, o)} />
                ))}
              </ul>
              {ranked.length > TOP_OUTCOMES ? (
                <button
                  type="button"
                  onClick={() => setSheet("outcomes")}
                  className="h-11 border-hairline border-t font-medium text-[13px] text-ink-2 hover:text-ink"
                >
                  All {ranked.length} outcomes
                </button>
              ) : null}
            </div>
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

        {wide ? (
          <div className="sticky top-4 self-start">
            {market ? <PmTicket market={market} outcome={outcome} onOutcome={setOutcome} book={book} /> : null}
          </div>
        ) : null}
      </div>

      {!wide && market && chosen ? (
        <div className="sticky bottom-[calc(var(--dock-h)+20px)] z-[var(--z-float)] grid grid-cols-2 gap-2 md:bottom-4">
          {e.markets.length > 1 && !headingSeen ? (
            <span className="col-span-2 mx-auto max-w-full truncate rounded-full bg-surface-1/90 px-3 py-1 text-[12px] text-ink-2 backdrop-blur">
              {market.title}
            </span>
          ) : null}
          {market.outcomes.map((o, i) => (
            <button
              key={o.tokenId}
              type="button"
              onClick={() => {
                setOutcome(i);
                setSheet("ticket");
              }}
              className={cx(
                "h-13 rounded-full font-bold text-[15px] text-bg shadow-[var(--shadow-receipt)]",
                i === 0 ? "bg-up" : "bg-down",
              )}
            >
              {o.label} {cents(o.price)}
            </button>
          ))}
        </div>
      ) : null}

      <Sheet open={sheet === "ticket" && !wide} onClose={() => setSheet(null)} title={market?.title ?? ""}>
        {market ? (
          <PmTicket market={market} outcome={outcome} onOutcome={setOutcome} book={book} keypad={phone} bare />
        ) : null}
      </Sheet>
      <Sheet open={sheet === "outcomes"} onClose={() => setSheet(null)} title={`${ranked.length} outcomes`} wide>
        <label className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface-2 px-4">
          <Search size={16} className="text-muted" />
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Search outcomes"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
        </label>
        <ul className="-mx-5 flex flex-col divide-y divide-[var(--hairline)]">
          {ranked
            .filter(({ m }) => !q.trim() || m.title.toLowerCase().includes(q.trim().toLowerCase()))
            .map(({ m, i }) => (
              <OutcomeRow key={m.id} m={m} active={i === marketIndex} onPick={(o) => pickOutcome(i, o)} />
            ))}
        </ul>
      </Sheet>
    </section>
  );
}
