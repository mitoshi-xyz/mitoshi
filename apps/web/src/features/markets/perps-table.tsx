"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { compactUsd, funding, pct, price, upDown } from "../format";
import { useLiveMids, usePerps } from "../hyperliquid/hooks";

const SKELETON_ROWS = 10;

/** Hyperliquid perps: live prices, today's move, funding, open interest and volume. */
export function PerpsTable() {
  const perps = usePerps();
  const mids = useLiveMids();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.trim().toUpperCase();
    return (perps.data ?? []).filter((p) => !q || p.name.includes(q)).sort((a, b) => b.dayVolumeUsd - a.dayVolumeUsd);
  }, [perps.data, search]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-xl">Perpetuals</h2>
        <input
          className="w-40 rounded-lg border border-white/20 bg-transparent px-3 py-1.5 text-sm"
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {perps.isError ? (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-red-400">Could not load markets: {perps.error.message}</span>
          <button type="button" className="underline" onClick={() => void perps.refetch()}>
            Retry
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs opacity-60">
            <tr>
              <th className="py-2 font-normal">Market</th>
              <th className="py-2 text-right font-normal">Price</th>
              <th className="py-2 text-right font-normal">24h</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Funding / h</th>
              <th className="hidden py-2 text-right font-normal sm:table-cell">Open interest</th>
              <th className="py-2 text-right font-normal">Volume</th>
            </tr>
          </thead>
          <tbody>
            {perps.isPending
              ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={`s-${i}`} className="animate-pulse">
                    <td colSpan={6} className="py-2">
                      <div className="h-5 rounded bg-white/5" />
                    </td>
                  </tr>
                ))
              : rows.map((p) => {
                  const live = mids[p.name] ?? p.midPx ?? p.markPx;
                  const change = p.prevDayPx > 0 ? live / p.prevDayPx - 1 : 0;
                  return (
                    <tr key={p.name} className="border-white/5 border-t hover:bg-white/5">
                      <td className="py-2">
                        <Link href={`/trade#${p.name}`} className="flex items-baseline gap-2">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-xs opacity-50">{p.maxLeverage}×</span>
                        </Link>
                      </td>
                      <td className="py-2 text-right font-mono">{price(live)}</td>
                      <td className={`py-2 text-right font-mono ${upDown(change)}`}>{pct(change)}</td>
                      <td className="hidden py-2 text-right font-mono sm:table-cell">{funding(p.funding)}</td>
                      <td className="hidden py-2 text-right font-mono sm:table-cell">
                        {compactUsd(p.openInterestUsd)}
                      </td>
                      <td className="py-2 text-right font-mono">{compactUsd(p.dayVolumeUsd)}</td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!perps.isPending && rows.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-60">No market matches “{search}”.</p>
        ) : null}
      </div>
    </section>
  );
}
