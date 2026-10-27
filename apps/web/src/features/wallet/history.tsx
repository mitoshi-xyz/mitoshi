"use client";

import type { PrivateWallet, Registry } from "@mitoshi/engine";
import type { HistoryEntry } from "@mitoshi/zwallet";
import { ChevronRight, History as HistoryIcon } from "lucide-react";
import { useMemo } from "react";
import { cx, EmptyState } from "@/kit";
import { VenueMark } from "../marks/mark";
import { openDeposit, openPublicView } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { shortAddress, VENUES } from "../private-wallets/venues";
import { MASK, useHideAmounts } from "../shell/prefs";
import { openReceipt } from "./receipt";
import { progress, signed, statusLine, story, UNIT } from "./tx";

const MS = 1000;
const DAY_MS = 86_400_000;

/** The wallet moments worth a line of their own (fundings and trips home already show as their transactions). */
const MOMENTS: Partial<Record<PrivateWallet["status"], (venue: string) => string>> = {
  ready: (v) => `${v} wallet ready`,
  refunded: (v) => `${v} funding refunded`,
  failed: (v) => `${v} wallet needs you`,
};

type Item =
  | { kind: "tx"; key: string; at: number; e: HistoryEntry }
  | { kind: "wallet"; key: string; at: number; w: PrivateWallet; title: string };

function items(entries: HistoryEntry[], registry: Registry): Item[] {
  const now = Date.now();
  const txs: Item[] = entries.map((e) => ({ kind: "tx", key: e.txid, at: e.time ? e.time * MS : now, e }));
  const moments: Item[] = registry.wallets.flatMap((w) => {
    const name = VENUES[w.venue].name;
    return [
      ...w.timeline.flatMap((t) => {
        const title = MOMENTS[t.status]?.(name);
        return title ? [{ kind: "wallet" as const, key: `${w.id}:${t.status}:${t.at}`, at: t.at, w, title }] : [];
      }),
      ...(w.trades ?? []).map((t) => ({
        kind: "wallet" as const,
        key: `${w.id}:trade:${t.at}:${t.ref ?? ""}`,
        at: t.at,
        w,
        title: t.label,
      })),
    ];
  });
  return [...txs, ...moments].sort((a, b) => b.at - a.at);
}

function dayLabel(at: number): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (at >= start.getTime()) return "Today";
  if (at >= start.getTime() - DAY_MS) return "Yesterday";
  return new Date(at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const time = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

function TxRow({ e, tip, hidden }: { e: HistoryEntry; tip: number | null; hidden: boolean }) {
  const registry = useRegistry();
  const s = story(e, registry);
  const p = progress(e, tip);
  const Icon = s.icon;
  return (
    <button
      type="button"
      onClick={() => openReceipt(e.txid)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-1"
    >
      <span className="relative shrink-0">
        <span
          className={cx(
            "flex size-10 items-center justify-center rounded-full",
            s.tone === "in" ? "bg-up-wash text-up" : "bg-surface-2 text-ink-2",
          )}
        >
          <Icon size={18} />
        </span>
        {s.venue ? (
          <VenueMark venue={s.venue} size={16} className="absolute -right-1 -bottom-1 ring-2 ring-[var(--stage)]" />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <span className="truncate font-medium text-[14px]">{s.title}</span>
        <span className="truncate text-[12px] text-muted">
          {e.time ? time(e.time * MS) : "Just now"}
          {" · "}
          <span className={cx(!p.settled && !e.expired && "text-accent")}>
            {p.settled ? (e.expired ? statusLine(e, p) : "Confirmed") : statusLine(e, p)}
          </span>
          {e.fromPublic && !e.internal ? <span className="text-warning"> · public origin</span> : null}
        </span>
      </span>
      <span className={cx("num shrink-0 text-[14px]", s.tone === "in" && !s.moved ? "text-up" : "text-ink")}>
        {hidden ? MASK : signed(s)}
        <span className="ml-1 text-[11px] text-muted">{UNIT}</span>
      </span>
    </button>
  );
}

function WalletRow({ w, title, at }: { w: PrivateWallet; title: string; at: number }) {
  return (
    <button
      type="button"
      onClick={() => openPublicView(w.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-1"
    >
      <VenueMark venue={w.venue} size={40} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
        <span className="truncate font-medium text-[14px]">{title}</span>
        <span className="num truncate text-[12px] text-muted">
          {time(at)} · {shortAddress(w.address)}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </button>
  );
}

/**
 * Everything that happened, newest first and grouped by day: the shielded wallet's transactions (each opens its
 * receipt) and the private wallets' moments and trades (each opens what the public sees of that wallet).
 */
export function History({ entries, tip }: { entries: HistoryEntry[]; tip: number | null }) {
  const registry = useRegistry();
  const [hidden] = useHideAmounts();
  const list = useMemo(() => items(entries, registry), [entries, registry]);
  if (list.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="Nothing yet"
        body="Deposits, fundings, trades and trips home land here."
        action={{ label: "Deposit", onClick: openDeposit }}
      />
    );
  }
  const days: { label: string; items: Item[] }[] = [];
  for (const it of list) {
    const label = dayLabel(it.at);
    const day = days.at(-1);
    if (day?.label === label) day.items.push(it);
    else days.push({ label, items: [it] });
  }
  return (
    <div className="flex flex-col gap-4">
      {days.map((d) => (
        <section key={d.label} className="flex flex-col gap-1">
          <h3 className="px-2 font-medium text-[12px] text-muted">{d.label}</h3>
          <ul className="flex flex-col">
            {d.items.map((it) => (
              <li key={it.key}>
                {it.kind === "tx" ? (
                  <TxRow e={it.e} tip={tip} hidden={hidden} />
                ) : (
                  <WalletRow w={it.w} title={it.title} at={it.at} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
