"use client";

import { CATEGORIES, type Category } from "@mitoshi/venues/polymarket";
import { useQuery } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { cx, EmptyState, Skeleton } from "@/kit";
import { VenueMark } from "../marks/mark";
import { EventCard } from "./event-card";
import { pmMarket } from "./pm";

const LIST_STALE_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_CARDS = 9;

/** Predict: every open Polymarket event by category or search, most traded first. */
export function EventGrid() {
  const [category, setCategory] = useState<Category>("trending");
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [typed]);
  const events = useQuery({
    queryKey: ["polymarket", "events", search ? `q:${search}` : category],
    queryFn: () => (search ? pmMarket.search(search) : pmMarket.events(category)),
    staleTime: LIST_STALE_MS,
  });

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-3 type-headline-lg">
            Predict <VenueMark venue="polymarket" size={26} />
          </h1>
          <p className="text-ink-2">Polymarket's events. Buy Yes or No from a wallet nobody can trace back to you.</p>
        </div>
        <input
          className="h-10 w-full rounded-full border border-hairline bg-surface-1 px-4 text-sm outline-none placeholder:text-muted focus:border-strong sm:w-64"
          placeholder="Search events"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => {
              setCategory(c.slug);
              setTyped("");
            }}
            className={cx(
              "h-9 shrink-0 rounded-full px-4 font-medium text-[13px] transition-colors",
              !search && category === c.slug ? "bg-ink text-bg" : "bg-surface-1 text-ink-2 hover:text-ink",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {events.isError ? (
        <EmptyState
          icon={SearchX}
          title="Polymarket did not answer"
          body={events.error.message}
          action={{ label: "Try again", onClick: () => void events.refetch() }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {events.isPending
            ? Array.from({ length: SKELETON_CARDS }, (_, i) => <Skeleton key={`s-${i}`} className="h-56 rounded-xl" />)
            : (events.data ?? []).map((e) => <EventCard key={e.id} e={e} />)}
        </div>
      )}
      {!events.isPending && events.data?.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={search ? `Nothing open matches “${search}”` : "No open events here right now"}
          body="Try another word or category."
        />
      ) : null}
    </section>
  );
}
