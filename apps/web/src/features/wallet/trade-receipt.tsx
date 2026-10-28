"use client";

import { latestSwap, type PrivateWallet, type TradeRecord, type Venue } from "@mitoshi/engine";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Eye, ReceiptText } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Drawer } from "@/kit";
import { hlMarket } from "../hyperliquid/hl";
import { Mark, VenueMark } from "../marks/mark";
import { openPublicView } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { shortAddress, VENUES } from "../private-wallets/venues";
import { openReceipt } from "./receipt";
import { explorerUrl } from "./tx";

const FOLIO = 6;
/** Where each venue's transactions can be looked up, one by one. */
const TX_PAGE: Record<Venue, (tx: string) => { label: string; href: string }> = {
  hyperliquid: (tx) => ({ label: "Hyperliquid explorer", href: `https://app.hyperliquid.xyz/explorer/tx/${tx}` }),
  solana: (tx) => ({ label: "Solscan", href: `https://solscan.io/tx/${tx}` }),
  polymarket: (tx) => ({ label: "Polygonscan", href: `https://polygonscan.com/tx/${tx}` }),
};

/** Which trade receipt is open: one for the whole app, opened from History. */
let open: { wallet: string; at: number } | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export function openTradeReceipt(wallet: string, at: number) {
  open = { wallet, at };
  emit();
}

function closeTradeReceipt() {
  open = null;
  emit();
}

function useOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => open,
    () => null,
  );
}

function Proof({ links }: { links: { label: string; href: string }[] }) {
  return (
    <span className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noreferrer noopener"
          referrerPolicy="no-referrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-strong px-3 py-1.5 font-medium text-[13px] hover:bg-surface-2"
        >
          {l.label} <ExternalLink size={12} />
        </a>
      ))}
    </span>
  );
}

/**
 * A trade's two sides, each checkable in public: the trade itself in the venue's own record (its transaction where
 * the venue has one, else the wallet's public page), and the shielded ZEC that funded the wallet, on Zcash. Nothing
 * joins the two but this browser.
 */
function TradeSlip({ w, t }: { w: PrivateWallet; t: TradeRecord }) {
  const venue = VENUES[w.venue];
  const oid = w.venue === "hyperliquid" && t.ref && /^\d+$/.test(t.ref) ? Number(t.ref) : null;
  // Hyperliquid answers with an order id; the transaction that filled it comes from the wallet's own fills.
  const fill = useQuery({
    queryKey: ["hyperliquid", "fill-hash", w.address, oid],
    enabled: oid !== null,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: () => hlMarket.fillHash(w.address as `0x${string}`, oid as number),
  });
  const tradeTx = w.venue === "solana" ? (t.ref ?? null) : w.venue === "hyperliquid" ? (fill.data ?? null) : null;
  const onVenue = tradeTx ? [TX_PAGE[w.venue](tradeTx)] : venue.explorers(w.address);
  const fund = latestSwap(w, "fund");

  return (
    <>
      <article className="flex flex-col gap-4 rounded-[20px] bg-cream p-5 text-cream-ink shadow-[var(--shadow-receipt)]">
        <header className="flex items-center justify-between">
          <span className="font-stamp text-[15px]">見通し</span>
          <span className="type-label text-cream-ink/60">
            Trade · {(t.ref ?? String(t.at)).slice(0, FOLIO).toUpperCase()}
          </span>
        </header>
        <div className="flex items-center gap-3">
          <VenueMark venue={w.venue} size={40} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-[20px]">{t.label}</span>
            <span className="num text-[13px] text-cream-ink/65">
              {new Date(t.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} ·{" "}
              {shortAddress(w.address)}
            </span>
          </div>
        </div>
      </article>

      <section className="flex flex-col gap-3">
        <h3 className="type-title">Proof, both ways</h3>
        <div className="flex flex-col gap-2 rounded-xl border border-hairline p-4">
          <span className="flex items-center gap-2 font-medium text-[14px]">
            <VenueMark venue={w.venue} size={18} /> On {venue.name}
            <span className="font-normal text-muted">· {tradeTx ? "this trade" : "this wallet's trades"}</span>
          </span>
          <Proof links={onVenue} />
        </div>
        {fund?.depositTx ? (
          <div className="flex flex-col gap-2 rounded-xl border border-hairline p-4">
            <span className="flex items-center gap-2 font-medium text-[14px]">
              <Mark symbol="ZEC" size={18} /> On Zcash
              <span className="font-normal text-muted">· the shielded funding</span>
            </span>
            <span className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  closeTradeReceipt();
                  openReceipt(fund.depositTx as string);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-strong px-3 py-1.5 font-medium text-[13px] hover:bg-surface-2"
              >
                <ReceiptText size={12} /> Receipt
              </button>
              <Proof
                links={[
                  { label: "Zcash explorer", href: explorerUrl(fund.depositTx) },
                  ...(fund.settledTx
                    ? [{ ...TX_PAGE[w.venue](fund.settledTx), label: `Arrived on ${venue.name}` }]
                    : []),
                ]}
              />
            </span>
          </div>
        ) : null}
        <p className="text-[12px] text-muted">These pages load from your browser, so the site sees your IP.</p>
      </section>

      <button
        type="button"
        onClick={() => {
          closeTradeReceipt();
          openPublicView(w.id);
        }}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-strong font-medium text-[14px] hover:bg-surface-1"
      >
        <Eye size={16} /> What the public sees
      </button>
    </>
  );
}

/** The trade receipt drawer, mounted once by the shell. */
export function TradeReceiptHost() {
  const o = useOpen();
  const registry = useRegistry();
  const w = o ? registry.wallets.find((x) => x.id === o.wallet) : undefined;
  const t = w?.trades?.find((x) => x.at === o?.at);
  return (
    <Drawer open={Boolean(w && t)} onClose={closeTradeReceipt} title="Trade receipt">
      {w && t ? <TradeSlip w={w} t={t} /> : null}
    </Drawer>
  );
}
