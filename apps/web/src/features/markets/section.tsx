import Link from "next/link";
import type { ReactNode } from "react";
import { type Venue, VenueMark } from "../marks/mark";

/** A numbered section head ("01 · Predictions on Polymarket"), Mitoshi's rhythm for long pages. */
export function SectionHead({
  index,
  title,
  venue,
  href,
  action,
  extra,
}: {
  index: string;
  title: string;
  venue?: Venue;
  href?: string;
  action?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="num text-[13px] text-accent">{index}</span>
        <h2 className="type-title-lg">{title}</h2>
        {venue ? <VenueMark venue={venue} size={20} /> : null}
      </div>
      <div className="flex items-center gap-3">
        {extra}
        {href ? (
          <Link href={href} className="text-[13px] text-ink-2 hover:text-ink">
            {action ?? "See all"} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
