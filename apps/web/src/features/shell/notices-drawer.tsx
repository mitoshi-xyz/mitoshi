"use client";

import type { Notice } from "@mitoshi/engine";
import { Bell, CheckCircle2, ChevronRight, CircleAlert, Info } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { cx, Drawer, EmptyState } from "@/kit";
import { useRegistry } from "../private-wallets/registry-store";
import { useNow } from "../private-wallets/use-now";
import { clearNotices, markNoticesSeen } from "./notices";

const ICON = { up: CheckCircle2, info: Info, down: CircleAlert };
const TONE = { up: "text-up", info: "text-ink-2", down: "text-down" };
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

function ago(ms: number): string {
  const m = Math.floor(ms / MS_PER_MINUTE);
  if (m < 1) return "just now";
  if (m < MINUTES_PER_HOUR) return `${m} min ago`;
  const h = Math.floor(m / MINUTES_PER_HOUR);
  if (h < HOURS_PER_DAY) return `${h} h ago`;
  return new Date(Date.now() - ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Row({ n, now, unseen, onOpen }: { n: Notice; now: number; unseen: boolean; onOpen: () => void }) {
  const Icon = ICON[n.tone];
  const body = (
    <>
      <Icon size={18} className={cx("mt-0.5 shrink-0", TONE[n.tone])} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium text-[14px]">{n.title}</span>
        {n.body ? <span className="text-[13px] text-ink-2">{n.body}</span> : null}
        <span className="text-[12px] text-muted">{ago(now - n.at)}</span>
      </span>
      {unseen ? (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent">
          <span className="sr-only">New</span>
        </span>
      ) : null}
      {n.href ? <ChevronRight size={16} className="mt-0.5 shrink-0 text-muted" /> : null}
    </>
  );
  const row = "flex w-full gap-3 rounded-lg px-3 py-3 text-left";
  return n.href ? (
    <Link href={n.href} onClick={onOpen} className={cx(row, "hover:bg-surface-2")}>
      {body}
    </Link>
  ) : (
    <div className={row}>{body}</div>
  );
}

/** Everything Mitoshi told you, kept after the toast left the screen: deposits, fills, wallets, the trip home. */
export function NoticesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const registry = useRegistry();
  const now = useNow();
  const notices = registry.notices ?? [];
  // What was new when the drawer opened stays marked while it is open.
  const seenBefore = registry.noticesSeenAt ?? 0;
  useEffect(() => {
    if (!open) return;
    return () => markNoticesSeen();
  }, [open]);
  return (
    <Drawer open={open} onClose={onClose} title="Notifications">
      {notices.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing yet"
          body="Deposits, fills, wallets getting ready and money coming home show up here."
        />
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="-mx-3 flex flex-col">
            {notices.map((n) => (
              <li key={n.id}>
                <Row n={n} now={now} unseen={n.at > seenBefore} onOpen={onClose} />
              </li>
            ))}
          </ul>
          <button type="button" onClick={clearNotices} className="self-center text-[12px] text-muted hover:text-ink">
            Clear all
          </button>
        </div>
      )}
    </Drawer>
  );
}
