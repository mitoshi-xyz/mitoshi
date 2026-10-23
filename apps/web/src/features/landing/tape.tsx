"use client";

import { price } from "../format";
import { useLiveMids } from "../hyperliquid/hooks";
import { Mark } from "../marks/mark";
import { useLiveMarks, usePerpMarkets } from "../perps/hooks";

const COINS = ["BTC", "ETH", "SOL", "ZEC", "HYPE", "XRP", "DOGE", "SUI", "AVAX", "LINK"];
/** Stocks, an index and commodities from Polymarket Perps, woven into the coins. */
const STOCKS = ["NVDA-USD", "TSLA-USD", "GOLD-USD", "SP500-USD", "AAPL-USD", "WTIOIL-USD"];
const EVERY = 2;

/** Live prices, as public data reaches every Mitoshi page: one shared stream through the relay. */
export function Tape() {
  const mids = useLiveMids();
  const stocks = usePerpMarkets("pmperps");
  const marks = useLiveMarks("pmperps");
  const items = COINS.flatMap((c, i) => {
    const coin = { key: c, name: c, logo: null as string | null, px: mids[c] };
    const stockId = i % EVERY === 1 ? STOCKS[(i - 1) / EVERY] : undefined;
    const m = stockId ? stocks.data?.find((x) => x.id === stockId) : undefined;
    return m ? [coin, { key: m.id, name: m.name, logo: m.logo, px: marks[m.id] ?? m.markPx }] : [coin];
  });
  const row = items.map((c) => (
    <span key={c.key} className="flex items-center gap-2 text-[14px]">
      <Mark symbol={c.name} src={c.logo} size={20} />
      <span className="font-medium">{c.name}</span>
      <span className="num text-[var(--lp-ink-2)]">{c.px ? price(c.px) : "–"}</span>
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
