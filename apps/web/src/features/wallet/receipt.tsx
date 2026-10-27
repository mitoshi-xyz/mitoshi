"use client";

import type { HistoryEntry } from "@mitoshi/zwallet";
import { Check, Copy, ExternalLink, ReceiptText } from "lucide-react";
import { useRef, useState, useSyncExternalStore } from "react";
import { ZEC_NETWORK } from "@/constants";
import { cx, DottedQr, Drawer, EmptyState } from "@/kit";
import { markStep } from "../judge/judge";
import { Mark, VenueMark } from "../marks/mark";
import { useRegistry } from "../private-wallets/registry-store";
import { Seal } from "../shell/seal";
import { explorerHost, explorerUrl, progress, signed, statusLine, story, UNIT, zec } from "./tx";
import { useWallet } from "./wallet-store";

const MS = 1000;
const FOLIO = 6;
const TXID_HEAD = 8;
const TXID_TAIL = 6;
const QR_PX = 92;
const COPIED_MS = 1_500;
const PERCENT = 100;
/** The bar shows a sliver before the first block, so it reads as started. */
const BAR_MIN_PERCENT = 4;
const NETWORK_NAME = ZEC_NETWORK === "main" ? "Zcash mainnet" : "Zcash testnet · test coins";

/** Which receipt is open: one for the whole app, so a notification, a History row or the money card opens the same. */
let openTxid: string | null = null;
const listeners = new Set<() => void>();

export function openReceipt(txid: string) {
  openTxid = txid;
  markStep("receipt");
  for (const l of listeners) l();
}

function closeReceipt() {
  openTxid = null;
  for (const l of listeners) l();
}

function useOpenTxid(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => openTxid,
    () => null,
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-cream-ink/55">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1.5 text-right">{children}</dd>
    </>
  );
}

function origin(e: HistoryEntry): string | null {
  if (e.internal) return e.fromPublic ? "From a public address" : null;
  if (e.delta < 0) return null;
  if (e.fromPublic === null) return "Checking where it came from…";
  return e.fromPublic ? "From a public address" : "From a shielded address";
}

/**
 * The receipt slip: the brand and folio, what moved, the seal pressed once it is final, the facts, then a perforated
 * stub to verify it on the chain (a link and its QR, for another device). Opening the explorer is the person's own
 * request from their own browser, so the stub says what that site learns.
 */
function Slip({ e, tip }: { e: HistoryEntry; tip: number | null }) {
  const registry = useRegistry();
  const [copied, setCopied] = useState(false);
  const s = story(e, registry);
  const p = progress(e, tip);
  const from = origin(e);
  const url = explorerUrl(e.txid);
  return (
    <article className="relative flex flex-col rounded-[20px] bg-cream text-cream-ink shadow-[var(--shadow-receipt)]">
      <div className="flex flex-col gap-4 p-5 pb-4">
        <header className="flex items-center justify-between">
          <span className="font-stamp text-[15px]">見通し</span>
          <span className="type-label text-cream-ink/60">Receipt · {e.txid.slice(0, FOLIO).toUpperCase()}</span>
        </header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="type-label text-cream-ink/60">{s.title}</span>
            <p className="num flex items-baseline gap-2 font-semibold text-[34px] leading-none">
              <span className={cx(s.tone === "in" && !s.moved && "text-[#2f7a00]")}>{signed(s)}</span>
              <span className="text-[15px]">{UNIT}</span>
            </p>
            {from ? <span className="text-[13px] text-cream-ink/70">{from}</span> : null}
          </div>
          {p.settled && !e.expired ? (
            <Seal size={64} className="mt-1 shrink-0 -rotate-[10deg] opacity-90" />
          ) : (
            <span className="relative mt-1 flex size-16 shrink-0 items-center justify-center">
              {s.venue ? <VenueMark venue={s.venue} size={40} /> : <Mark symbol="ZEC" size={40} />}
            </span>
          )}
        </div>
        {!p.settled ? (
          <div className="flex flex-col gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-ink/10">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${Math.max(BAR_MIN_PERCENT, (p.done / p.need) * PERCENT)}%` }}
              />
            </div>
            <span className="num text-[12px] text-cream-ink/70">
              {statusLine(e, p)} · about {p.minutesLeft} min
            </span>
          </div>
        ) : null}
        <div className="border-cream-hairline border-t" />
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-[13px]">
          <Fact label="Status">
            <span className={cx(!p.settled && "text-accent")}>
              {p.settled && !e.expired ? `Confirmed · ${p.done.toLocaleString()} blocks` : statusLine(e, p)}
            </span>
          </Fact>
          {e.time ? (
            <Fact label="When">
              {new Date(e.time * MS).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </Fact>
          ) : null}
          <Fact label="Network">
            <Mark symbol="ZEC" size={14} /> {NETWORK_NAME}
          </Fact>
          {e.minedHeight ? (
            <Fact label="Block">
              <span className="num">{e.minedHeight.toLocaleString()}</span>
            </Fact>
          ) : null}
          {/* Only a fee this wallet paid: a deposit's fee was the sender's. */}
          {e.fee !== null && (e.delta < 0 || e.internal) ? (
            <Fact label="Network fee">
              <span className="num">
                {zec(e.fee)} {UNIT}
              </span>
            </Fact>
          ) : null}
          <Fact label="Transaction">
            <span className="num truncate">
              {e.txid.slice(0, TXID_HEAD)}…{e.txid.slice(-TXID_TAIL)}
            </span>
            <button
              type="button"
              aria-label={copied ? "Copied" : "Copy the transaction id"}
              onClick={() => {
                void navigator.clipboard.writeText(e.txid).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), COPIED_MS);
                });
              }}
              className="-m-1 rounded p-1 hover:bg-cream-ink/10"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </Fact>
        </dl>
      </div>
      {/* The perforation, with notches cut in the colour of the drawer the slip sits on. */}
      <div aria-hidden className="relative h-5">
        <span className="absolute top-1/2 -left-2.5 size-5 -translate-y-1/2 rounded-full bg-surface-1" />
        <span className="absolute top-1/2 -right-2.5 size-5 -translate-y-1/2 rounded-full bg-surface-1" />
        <span className="absolute inset-x-5 top-1/2 border-cream-hairline border-t border-dashed" />
      </div>
      <footer className="flex items-center gap-4 p-5 pt-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-semibold text-[14px]">Verify it on chain</span>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            referrerPolicy="no-referrer"
            className="inline-flex items-center gap-1 self-start font-medium text-[13px] underline underline-offset-2"
          >
            Open in the explorer <ExternalLink size={12} />
          </a>
          <span className="truncate text-[11px] text-cream-ink/55">{explorerHost}</span>
          <span className="text-[11px] text-cream-ink/55 leading-snug">
            {e.fromPublic ? "The public side shows its amount there." : "It shows no amount and no addresses."} The site
            sees your IP.
          </span>
        </div>
        <span className="shrink-0 overflow-hidden rounded-lg">
          <DottedQr value={url} size={QR_PX} mark="/marks/venue-zcash.svg" />
        </span>
      </footer>
    </article>
  );
}

/** The receipt drawer, mounted once by the shell. It keeps the last slip while it slides away. */
export function ReceiptHost() {
  const txid = useOpenTxid();
  const w = useWallet();
  const last = useRef<string | null>(null);
  if (txid) last.current = txid;
  const shown = txid ?? last.current;
  const e = shown ? (w.history.find((h) => h.txid === shown) ?? null) : null;
  return (
    <Drawer open={txid !== null} onClose={closeReceipt} title="Receipt">
      {e ? (
        <Slip e={e} tip={w.summary?.tip ?? null} />
      ) : shown ? (
        <EmptyState
          icon={ReceiptText}
          title="Not in this wallet yet"
          body="It shows here once the wallet has synced past it."
        />
      ) : null}
    </Drawer>
  );
}
