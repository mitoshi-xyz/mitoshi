"use client";

import Link from "next/link";
import { ChangeChip, RollingNumber, Sparkline } from "@/kit";
import { compactUsd, funding } from "../format";
import { Mark } from "../marks/mark";
import { usePerpSparkline } from "../perps/hooks";
import { CATEGORY_LABEL, type PerpMarket, terminalHref } from "../perps/model";

const PRICE_SIG = 6;

/** One perp: mark, name, the day's sparkline, the live price rolling, 24h, funding, open interest. */
export function PerpRow({ perp, live }: { perp: PerpMarket; live: number | undefined }) {
  const spark = usePerpSparkline(perp);
  const px = live ?? perp.midPx ?? perp.markPx;
  const change = perp.prevDayPx > 0 ? px / perp.prevDayPx - 1 : 0;
  return (
    <Link
      href={terminalHref(perp)}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-1 sm:grid-cols-[minmax(140px,1.4fr)_96px_1fr_88px_1fr_1fr]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Mark symbol={perp.name} src={perp.logo} size={32} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate font-semibold text-sm">{perp.name}</span>
          <span className="text-[12px] text-muted">
            {perp.venue === "pmperps" ? `${CATEGORY_LABEL[perp.category] ?? perp.category} · ` : ""}
            {perp.maxLeverage}×
          </span>
        </span>
      </span>
      <span className="hidden sm:block">
        <Sparkline points={spark.data ?? []} />
      </span>
      <span className="text-right">
        <RollingNumber value={px} format={{ maximumSignificantDigits: PRICE_SIG }} className="text-sm" />
        <span className="block sm:hidden">
          <ChangeChip change={change} />
        </span>
      </span>
      <span className="hidden text-right sm:block">
        <ChangeChip change={change} />
      </span>
      <span className={`num hidden text-right text-[13px] sm:block ${perp.funding >= 0 ? "text-up" : "text-down"}`}>
        {funding(perp.funding)}
      </span>
      <span className="num hidden text-right text-[13px] text-ink-2 sm:block">{compactUsd(perp.openInterestUsd)}</span>
    </Link>
  );
}

export function PerpHeader() {
  return (
    <div className="hidden grid-cols-[minmax(140px,1.4fr)_96px_1fr_88px_1fr_1fr] gap-3 px-3 pb-1 type-label text-muted sm:grid">
      <span>Market</span>
      <span>24h</span>
      <span className="text-right">Price</span>
      <span className="text-right">Change</span>
      <span className="text-right">Funding / h</span>
      <span className="text-right">Open interest</span>
    </div>
  );
}
