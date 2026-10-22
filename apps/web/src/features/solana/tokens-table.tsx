"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { compactUsd, pct, price, upDown } from "../format";
import { usePrices, useTokens } from "./hooks";
import { solImage } from "./sol";

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 10;

/** Solana tokens: trending now, or a search; prices refresh every few seconds. */
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
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-xl">Solana tokens</h2>
        <input
          className="w-48 rounded-lg border border-white/20 bg-transparent px-3 py-1.5 text-sm"
          placeholder="Search name or mint"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </div>
      {tokens.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-red-400">Could not load tokens: {tokens.error.message}</span>
          <button type="button" className="underline" onClick={() => void tokens.refetch()}>
            Retry
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs opacity-60">
            <tr>
              <th className="py-2 font-normal">Token</th>
              <th className="py-2 text-right font-normal">Price</th>
              <th className="py-2 text-right font-normal">24h</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Market cap</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Liquidity</th>
              <th className="py-2 text-right font-normal">Volume</th>
            </tr>
          </thead>
          <tbody>
            {tokens.isPending
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={`s-${i}`} className="animate-pulse">
                    <td colSpan={6} className="py-2">
                      <div className="h-5 rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              : (tokens.data ?? []).map((t) => {
                  const icon = solImage(t.icon);
                  return (
                    <tr key={t.mint} className="border-white/5 border-t hover:bg-white/5">
                      <td className="py-2">
                        <Link href={`/token#${t.mint}`} className="flex items-center gap-2">
                          {icon ? <img src={icon} alt="" className="size-5 rounded-full" loading="lazy" /> : null}
                          <span className="font-medium">{t.symbol}</span>
                          {t.verified ? <span className="text-emerald-400 text-xs">verified</span> : null}
                        </Link>
                      </td>
                      <td className="py-2 text-right font-mono">{price(prices.data?.[t.mint] ?? t.usdPrice)}</td>
                      <td className={`py-2 text-right font-mono ${upDown(t.change24h)}`}>{pct(t.change24h)}</td>
                      <td className="hidden py-2 text-right font-mono sm:table-cell">{compactUsd(t.mcap)}</td>
                      <td className="hidden py-2 text-right font-mono sm:table-cell">{compactUsd(t.liquidity)}</td>
                      <td className="py-2 text-right font-mono">{compactUsd(t.volume24h)}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!tokens.isPending && tokens.data?.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-60">No token matches “{search}”.</p>
        ) : null}
      </div>
    </section>
  );
}
