"use client";

import { ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HealthChip } from "./health-chip";
import { PLACES, placeFor } from "./places";
import { Seal } from "./seal";

/** The top line: the way back below a place, the relay's health, and search (⌘K). */
export function TopLine({ onSearch }: { onSearch: () => void }) {
  const path = usePathname();
  const place = placeFor(path);
  const deeper = place !== undefined && path !== place.href && !PLACES.some((p) => p.href === path);
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/markets" className="md:hidden" aria-label="Mitoshi">
          <Seal size={34} />
        </Link>
        {deeper && place ? (
          <Link
            href={place.href}
            className="inline-flex items-center gap-1 rounded-full py-1 pr-3 pl-1.5 text-[13px] text-ink-2 hover:bg-surface-1 hover:text-ink"
          >
            <ChevronLeft size={16} /> {place.name}
          </Link>
        ) : null}
        <span className="hidden sm:inline-flex">
          <HealthChip />
        </span>
      </div>
      <button
        type="button"
        onClick={onSearch}
        className="inline-flex h-10 items-center gap-3 rounded-full border border-hairline bg-surface-1/60 pr-2 pl-3.5 text-[13px] text-ink-2 hover:border-strong hover:text-ink"
      >
        <Search size={16} />
        <span className="hidden sm:inline">Search markets and pages</span>
        <kbd className="num rounded-md border border-hairline px-1.5 py-0.5 text-[11px] text-muted">⌘K</kbd>
      </button>
    </header>
  );
}
