"use client";

import { price } from "../format";
import { useLiveMids } from "../hyperliquid/hooks";
import { Mark } from "../marks/mark";

const COINS = ["BTC", "ETH", "SOL", "ZEC", "HYPE", "XRP", "DOGE", "SUI", "AVAX", "LINK"];

/** Live prices, as public data reaches every Mitoshi page: one shared stream through the relay. */
export function Tape() {
  const mids = useLiveMids();
  const row = COINS.map((c) => (
    <span key={c} className="flex items-center gap-2 text-[14px]">
      <Mark symbol={c} size={20} />
      <span className="font-medium">{c}</span>
      <span className="num text-[var(--lp-ink-2)]">{mids[c] ? price(mids[c]) : "–"}</span>
    </span>
  ));
  return (
    <div className="relative overflow-hidden border-[var(--lp-line)] border-y py-4 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
      <div className="lp-tape" aria-hidden>
        {row}
        {row.map((r) => (
          <span key={`again-${r.key}`}>{r}</span>
        ))}
      </div>
      <p className="sr-only">Live prices from Hyperliquid</p>
    </div>
  );
}
