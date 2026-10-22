"use client";

import { CATEGORIES, type Category, type PmEvent } from "@mitoshi/venues/polymarket";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { compactUsd } from "../format";
import { pmImage, pmMarket } from "./pm";

const LIST_STALE_MS = 30_000;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_CARDS = 9;
const CARD_OUTCOMES = 2;
const PCT = 100;

function EventCard({ e }: { e: PmEvent }) {
  const img = pmImage(e.image);
  const binary = e.markets.length === 1;
  const top = binary ? [] : e.markets.slice(0, CARD_OUTCOMES);
  const yes = e.markets[0]?.outcomes[0];
  return (
    <Link
      href={`/event#${e.id}`}
      className="flex flex-col gap-3 rounded-xl border border-white/10 p-4 transition-colors hover:border-white/30"
    >
      <div className="flex items-start gap-3">
        {img ? <img src={img} alt="" className="size-10 shrink-0 rounded-md object-cover" loading="lazy" /> : null}
        <h3 className="font-medium leading-snug">{e.title}</h3>
      </div>
      {binary && yes ? (
        <p className="font-mono text-2xl">
          {Math.round(yes.price * PCT)}% <span className="text-sm opacity-60">chance</span>
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {top.map((m) => (
            <li key={m.id} className="flex justify-between gap-3">
              <span className="truncate opacity-80">{m.title}</span>
              <span className="font-mono">{Math.round((m.outcomes[0]?.price ?? 0) * PCT)}%</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-xs opacity-50">
        {compactUsd(e.volume24h)} today · {compactUsd(e.volume)} total
        {e.endDate ? ` · ends ${new Date(e.endDate).toLocaleDateString()}` : ""}
      </p>
    </Link>
  );
}

/** Polymarket events by category or search, most traded first. */
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
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => {
                setCategory(c.slug);
                setTyped("");
              }}
              className={`rounded-full px-3 py-1 text-sm ${!search && category === c.slug ? "bg-white text-black" : "opacity-70 hover:opacity-100"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          className="w-48 rounded-lg border border-white/20 bg-transparent px-3 py-1.5 text-sm"
          placeholder="Search markets"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
      {events.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-red-400">Could not load markets: {events.error.message}</span>
          <button type="button" className="underline" onClick={() => void events.refetch()}>
            Retry
          </button>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.isPending
          ? Array.from({ length: SKELETON_CARDS }, (_, i) => (
              <div key={`s-${i}`} className="h-40 animate-pulse rounded-xl bg-white/5" />
            ))
          : (events.data ?? []).map((e) => <EventCard key={e.id} e={e} />)}
      </div>
      {!events.isPending && events.data?.length === 0 ? (
        <p className="py-6 text-center text-sm opacity-60">
          {search ? `No open market matches “${search}”.` : "No open markets in this category right now."}
        </p>
      ) : null}
    </section>
  );
}
