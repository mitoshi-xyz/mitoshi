"use client";

import type { PmEvent } from "@mitoshi/venues/polymarket";
import Link from "next/link";
import { cx } from "@/kit";
import { compactUsd } from "../format";
import { Mark, VenueMark } from "../marks/mark";

const PCT = 100;
const CARD_OUTCOMES = 3;

const cents = (p: number) => `${Math.round(p * PCT)}¢`;
const ends = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;

/** An outcome's chance as a ramp: the bar's width is the Yes price. */
function Ramp({ p, tone = "up" }: { p: number; tone?: "up" | "accent" }) {
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span
        className={cx("absolute inset-y-0 left-0 rounded-full", tone === "up" ? "bg-up" : "bg-accent")}
        style={{ width: `${Math.min(PCT, Math.max(0, p * PCT))}%` }}
      />
    </span>
  );
}

/**
 * A Polymarket event, Mitoshi-style: its picture and question, the live odds (one ramp for a yes/no market, the
 * leading outcomes for a multi-outcome event), Yes/No prices in cents, and volume and close date.
 */
export function EventCard({ e }: { e: PmEvent }) {
  const binary = e.markets.length === 1;
  const m = e.markets[0];
  const yes = m?.outcomes[0];
  const no = m?.outcomes[1];
  const when = ends(e.endDate);
  return (
    <Link
      href={`/event#${e.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-4 transition-[border-color,transform] duration-[var(--dur-state)] hover:-translate-y-0.5 hover:border-strong"
    >
      <div className="flex items-start gap-3">
        <Mark symbol={e.title} src={e.image} size={44} className="rounded-lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="line-clamp-2 font-semibold text-[15px] leading-snug">{e.title}</h3>
          {e.tags[0] ? <span className="text-[12px] text-muted">{e.tags[0]}</span> : null}
        </div>
      </div>
      {binary && yes && no ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="type-label text-muted">Live odds</span>
            <span className="num font-semibold text-[22px]">
              {Math.round(yes.price * PCT)}% <span className="font-normal text-[12px] text-muted">chance</span>
            </span>
          </div>
          <Ramp p={yes.price} />
          <div className="grid grid-cols-2 gap-2">
            <span className="rounded-md border border-up/30 bg-up-wash py-2 text-center font-semibold text-[13px] text-up">
              {yes.label} {cents(yes.price)}
            </span>
            <span className="rounded-md border border-down/30 bg-down-wash py-2 text-center font-semibold text-[13px] text-down">
              {no.label} {cents(no.price)}
            </span>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {e.markets.slice(0, CARD_OUTCOMES).map((x) => {
            const p = x.outcomes[0]?.price ?? 0;
            return (
              <li key={x.id} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-ink-2">{x.title}</span>
                  <span className="num font-semibold">{Math.round(p * PCT)}%</span>
                </span>
                <Ramp p={p} tone="accent" />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-auto flex items-center justify-between text-[12px] text-muted">
        <span className="num">
          {compactUsd(e.volume24h)} today{when ? ` · ends ${when}` : ""}
        </span>
        <VenueMark venue="polymarket" size={16} className="opacity-80" />
      </div>
    </Link>
  );
}
