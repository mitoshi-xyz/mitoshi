"use client";

import { Bell, ChevronLeft, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DeskChip } from "../judge/desk-sheet";
import { useRegistry } from "../private-wallets/registry-store";
import { HealthChip } from "./health-chip";
import { unseenCount } from "./notices";
import { PLACES, placeFor } from "./places";
import { Seal } from "./seal";

/** The top line: the way back below a place, the relay's health, notifications, and search (⌘K). */
export function TopLine({ onSearch, onNotices }: { onSearch: () => void; onNotices: () => void }) {
  const path = usePathname();
  const place = placeFor(path);
  const deeper = place !== undefined && path !== place.href && !PLACES.some((p) => p.href === path);
  const unseen = unseenCount(useRegistry());
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
      <div className="flex items-center gap-2">
        <DeskChip />
        <button
          type="button"
          onClick={onNotices}
          aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"}
          className="relative inline-flex size-11 items-center justify-center rounded-full border border-hairline bg-surface-1/60 text-ink-2 hover:border-strong hover:text-ink md:size-10"
        >
          <Bell size={18} />
          {unseen ? (
            <span className="absolute top-2 right-2 size-2.5 rounded-full bg-accent ring-2 ring-bg" aria-hidden />
          ) : null}
        </button>
        {/* A plain round button on phones (a 44 px target, no keyboard hint); the pill with ⌘K from tablets up. */}
        <button
          type="button"
          onClick={onSearch}
          aria-label="Search markets and pages"
          className="inline-flex size-11 items-center justify-center gap-3 rounded-full border border-hairline bg-surface-1/60 text-[13px] text-ink-2 hover:border-strong hover:text-ink md:h-10 md:w-auto md:justify-start md:pr-2 md:pl-3.5"
        >
          <Search size={18} />
          <span className="hidden md:inline">Search markets and pages</span>
          <kbd className="num hidden rounded-md border border-hairline px-1.5 py-0.5 text-[11px] text-muted md:inline">
            ⌘K
          </kbd>
        </button>
      </div>
    </header>
  );
}
