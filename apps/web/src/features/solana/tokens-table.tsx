"use client";

import { SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, Skeleton } from "@/kit";
import { VenueMark } from "../marks/mark";
import { usePrices, useTokens } from "./hooks";
import { TokenHeader, TokenRow } from "./token-row";

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 10;

/** Tokens: Solana's trending tokens (or a search), live prices every few seconds. */
export function TokensTable() {
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [typed]);
  const tokens = useTokens(search);
  const prices = usePrices((tokens.data ?? []).map((t) => t.mint));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-3 type-headline-lg">
            Tokens <VenueMark venue="solana" size={26} /> <VenueMark venue="jupiter" size={26} />
          </h1>
          <p className="text-ink-2">Trending on Solana, routed by Jupiter. Each buy from its own new wallet.</p>
        </div>
        <input
          className="h-10 w-full rounded-full border border-hairline bg-surface-1 px-4 text-sm outline-none placeholder:text-muted focus:border-strong sm:w-64"
          placeholder="Search a name or mint"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
      {tokens.isError ? (
        <EmptyState
          icon={SearchX}
          title="Jupiter did not answer"
          body={tokens.error.message}
          action={{ label: "Try again", onClick: () => void tokens.refetch() }}
        />
      ) : (
        <div className="flex flex-col">
          <TokenHeader />
          {tokens.isPending
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={`s-${i}`} className="my-1 h-12" />)
            : (tokens.data ?? []).map((t) => <TokenRow key={t.mint} t={t} live={prices.data?.[t.mint]} />)}
        </div>
      )}
      {!tokens.isPending && tokens.data?.length === 0 ? (
        <EmptyState icon={SearchX} title={`No token matches “${search}”`} />
      ) : null}
    </section>
  );
}
