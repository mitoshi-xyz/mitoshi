"use client";

import type { SolToken } from "@mitoshi/venues/solana";
import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { ChangeChip, RollingNumber } from "@/kit";
import { compactUsd } from "../format";
import { Mark } from "../marks/mark";

const PRICE_SIG = 5;

/** One Solana token: its icon, name, verified mark, live price, 24h, market cap, liquidity. */
export function TokenRow({ t, live }: { t: SolToken; live: number | undefined }) {
  const px = live ?? t.usdPrice;
  return (
    <Link
      href={`/token#${t.mint}`}
      className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-1 sm:grid-cols-[minmax(160px,1.6fr)_1fr_88px_1fr_1fr]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Mark symbol={t.symbol} src={t.icon} size={32} />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="flex items-center gap-1 font-semibold text-sm">
            {t.symbol}
            {t.verified ? <BadgeCheck size={14} className="text-info" aria-label="Verified" /> : null}
          </span>
          <span className="truncate text-[12px] text-muted">{t.name}</span>
        </span>
      </span>
      <span className="text-right">
        <RollingNumber
          value={px}
          format={{ maximumSignificantDigits: PRICE_SIG, style: "currency", currency: "USD" }}
          className="text-sm"
        />
        <span className="block sm:hidden">
          <ChangeChip change={t.change24h} />
        </span>
      </span>
      <span className="hidden text-right sm:block">
        <ChangeChip change={t.change24h} />
      </span>
      <span className="num hidden text-right text-[13px] text-ink-2 sm:block">{compactUsd(t.mcap)}</span>
      <span className="num hidden text-right text-[13px] text-ink-2 sm:block">{compactUsd(t.liquidity)}</span>
    </Link>
  );
}

export function TokenHeader() {
  return (
    <div className="hidden grid-cols-[minmax(160px,1.6fr)_1fr_88px_1fr_1fr] gap-3 px-3 pb-1 type-label text-muted sm:grid">
      <span>Token</span>
      <span className="text-right">Price</span>
      <span className="text-right">Change</span>
      <span className="text-right">Market cap</span>
      <span className="text-right">Liquidity</span>
    </div>
  );
}
