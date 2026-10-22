"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { type HistoryEntry, ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ArrowDownLeft, ArrowUpRight, Copy, History as HistoryIcon, Repeat, Undo2 } from "lucide-react";
import { useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { cx, Drawer, EmptyState } from "@/kit";
import { type Venue, VenueMark } from "../marks/mark";
import { useRegistry } from "../private-wallets/registry-store";
import { MASK, useHideAmounts } from "../shell/prefs";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 8;
const MS = 1000;
const TXID_HEAD = 10;
const TXID_TAIL = 8;
const VENUE_NAMES: Record<string, string> = { hyperliquid: "Hyperliquid", polymarket: "Polymarket", solana: "Solana" };

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

interface Labelled {
  title: string;
  icon: typeof ArrowDownLeft;
  venue?: Venue;
  tone: "in" | "out" | "neutral";
}

/** What a transaction was, in words: matched against the private wallets' swaps where it can be. */
function label(e: HistoryEntry, wallets: PrivateWallet[]): Labelled {
  for (const w of wallets) {
    for (const s of w.swaps) {
      if (s.kind === "fund" && s.depositTx === e.txid) {
        return { title: `Funded a ${VENUE_NAMES[w.venue]} wallet`, icon: ArrowUpRight, venue: w.venue, tone: "out" };
      }
      if (s.kind === "return" && s.settledTx === e.txid) {
        return { title: `Came home from ${VENUE_NAMES[w.venue]}`, icon: ArrowDownLeft, venue: w.venue, tone: "in" };
      }
      if (s.kind === "fund" && s.status === "REFUNDED" && s.settledTx === e.txid) {
        return { title: "Refund from NEAR", icon: Undo2, tone: "in" };
      }
    }
  }
  if (e.internal) return { title: "Moved between pools", icon: Repeat, tone: "neutral" };
  return e.delta >= 0
    ? { title: "Received", icon: ArrowDownLeft, tone: "in" }
    : { title: "Sent", icon: ArrowUpRight, tone: "out" };
}

function statusOf(e: HistoryEntry, tip: number | null): { text: string; done: boolean } {
  if (e.expired) return { text: "Expired · nothing moved", done: true };
  if (e.minedHeight === null) return { text: "Confirming", done: false };
  return { text: tip ? `${(tip - e.minedHeight + 1).toLocaleString()} confirmations` : "Confirmed", done: true };
}

/** The receipt: a cream stub with everything about one transaction. */
function Receipt({ e, tip, onClose }: { e: HistoryEntry | null; tip: number | null; onClose: () => void }) {
  const registry = useRegistry();
  const [copied, setCopied] = useState(false);
  if (!e)
    return (
      <Drawer open={false} onClose={onClose} title="Receipt">
        {null}
      </Drawer>
    );
  const l = label(e, registry.wallets);
  const st = statusOf(e, tip);
  return (
    <Drawer open onClose={onClose} title="Receipt">
      <div className="flex flex-col gap-4 rounded-xl bg-cream p-5 text-cream-ink shadow-[var(--shadow-receipt)]">
        <div className="flex items-center justify-between">
          <span className="font-stamp text-[15px]">見通し</span>
          <span className="type-label">{l.title}</span>
        </div>
        <p className="num font-semibold text-[34px] leading-none">
          {e.delta >= 0 ? "+" : "−"}
          {zec(Math.abs(e.delta))} <span className="text-[16px]">{UNIT}</span>
        </p>
        <div className="border-cream-hairline border-t border-dashed" />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-cream-ink/60">Status</dt>
          <dd className="text-right">{st.text}</dd>
          {e.time ? (
            <>
              <dt className="text-cream-ink/60">When</dt>
              <dd className="text-right">{new Date(e.time * MS).toLocaleString()}</dd>
            </>
          ) : null}
          {e.minedHeight ? (
            <>
              <dt className="text-cream-ink/60">Block</dt>
              <dd className="num text-right">{e.minedHeight.toLocaleString()}</dd>
            </>
          ) : null}
          {e.fee !== null ? (
            <>
              <dt className="text-cream-ink/60">Network fee</dt>
              <dd className="num text-right">
                {zec(e.fee)} {UNIT}
              </dd>
            </>
          ) : null}
          <dt className="text-cream-ink/60">Came from</dt>
          <dd className="text-right">
            {e.fromPublic === null
              ? "checking…"
              : e.fromPublic
                ? "a public address (rests 2–6 h)"
                : "a shielded address"}
          </dd>
          <dt className="text-cream-ink/60">Transaction</dt>
          <dd className="flex items-center justify-end gap-1.5">
            <span className="num">
              {e.txid.slice(0, TXID_HEAD)}…{e.txid.slice(-TXID_TAIL)}
            </span>
            <button
              type="button"
              aria-label="Copy the transaction id"
              onClick={() => {
                void navigator.clipboard.writeText(e.txid);
                setCopied(true);
              }}
              className="rounded p-1 hover:bg-cream-ink/10"
            >
              <Copy size={13} />
            </button>
          </dd>
        </dl>
        {copied ? <p className="text-center text-[12px] text-cream-ink/60">Copied</p> : null}
      </div>
      <p className="text-[12px] text-muted">
        Only this browser can read this receipt: on the chain, a shielded transaction shows no amount and no addresses.
      </p>
    </Drawer>
  );
}

/** The wallet's transactions, newest first, each opening its receipt. */
export function History({ entries, tip }: { entries: HistoryEntry[]; tip: number | null }) {
  const registry = useRegistry();
  const [hidden] = useHideAmounts();
  const [open, setOpen] = useState<HistoryEntry | null>(null);
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="No transactions yet"
        body="Deposit from a shielded wallet and it shows up here within a block."
      />
    );
  }
  return (
    <>
      <ul className="flex flex-col">
        {entries.map((e) => {
          const l = label(e, registry.wallets);
          const st = statusOf(e, tip);
          const Icon = l.icon;
          return (
            <li key={e.txid}>
              <button
                type="button"
                onClick={() => setOpen(e)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-1"
              >
                <span className="relative">
                  <span
                    className={cx(
                      "flex size-10 items-center justify-center rounded-full",
                      l.tone === "in"
                        ? "bg-up-wash text-up"
                        : l.tone === "out"
                          ? "bg-surface-2 text-ink"
                          : "bg-surface-2 text-ink-2",
                    )}
                  >
                    <Icon size={18} />
                  </span>
                  {l.venue ? (
                    <VenueMark
                      venue={l.venue}
                      size={16}
                      className="absolute -right-1 -bottom-1 ring-2 ring-[var(--stage)]"
                    />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="flex items-center gap-2 font-medium text-sm">
                    {l.title}
                    {e.fromPublic ? (
                      <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                        public origin
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[12px] text-muted">
                    {e.time
                      ? new Date(e.time * MS).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Just now"}{" "}
                    · <span className={st.done ? "" : "text-accent"}>{st.text}</span>
                  </span>
                </span>
                <span className={cx("num text-sm", e.delta >= 0 ? "text-up" : "text-ink")}>
                  {hidden ? MASK : `${e.delta >= 0 ? "+" : "−"}${zec(Math.abs(e.delta))}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Receipt e={open} tip={tip} onClose={() => setOpen(null)} />
    </>
  );
}
