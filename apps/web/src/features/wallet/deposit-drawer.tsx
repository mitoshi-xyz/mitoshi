"use client";

import { BLOCK_SECONDS, type HistoryEntry, RECEIVED_CONFIRMATIONS, ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { Check, Copy, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { Button, DottedQr, Drawer, Skeleton, TxSteps, Wait } from "@/kit";
import { freshAddress, useWallet } from "./wallet-store";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const GROUP = 6;
const ZEC_DIGITS = 8;
const SECONDS_PER_MINUTE = 60;
/** Ten blocks at 75 s, rounded: what the copy promises before a deposit is spendable. */
const SPENDABLE_MINUTES = Math.round((RECEIVED_CONFIRMATIONS * BLOCK_SECONDS) / SECONDS_PER_MINUTE);

const grouped = (a: string) => a.match(new RegExp(`.{1,${GROUP}}`, "g"))?.join(" ") ?? a;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

/**
 * Deposit: a never-used shielded address as a dotted QR, and the deposit followed live: waiting, seen in a block,
 * counted to the 10 confirmations the wallet needs, then where it came from (a public address rests 2–6 h more).
 */
export function DepositDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useWallet();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const seenAtOpen = useRef<Set<string>>(new Set());

  const next = () => {
    setAddress(null);
    setCopied(false);
    freshAddress().then(setAddress, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  useEffect(() => {
    if (!open) return;
    seenAtOpen.current = new Set(w.history.map((h) => h.txid));
    setError(null);
    next();
    // Only on opening: later history changes are what we watch for.
  }, [open]);

  const arrived: HistoryEntry | undefined = open
    ? w.history.find((h) => h.delta > 0 && !seenAtOpen.current.has(h.txid))
    : undefined;
  const tip = w.summary?.tip ?? null;
  const confirmations = arrived?.minedHeight != null && tip !== null ? tip - arrived.minedHeight + 1 : 0;
  const spendable = confirmations >= RECEIVED_CONFIRMATIONS;
  const minutesLeft = Math.max(
    1,
    Math.ceil(((RECEIVED_CONFIRMATIONS - confirmations) * BLOCK_SECONDS) / SECONDS_PER_MINUTE),
  );

  return (
    <Drawer open={open} onClose={onClose} title={`Deposit ${UNIT}`}>
      {error ? (
        <p className="text-[13px] text-down">{error}</p>
      ) : !address ? (
        <Skeleton className="mx-auto h-[264px] w-[264px] rounded-xl" label="Making a fresh address" />
      ) : (
        <div className="flex flex-col items-center gap-4">
          <DottedQr value={address} mark="/marks/venue-zcash.svg" />
          <p className="num break-all text-center text-[12px] text-ink-2 leading-relaxed">{grouped(address)}</p>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button
              tone="primary"
              size="lg"
              icon={copied ? <Check size={16} /> : <Copy size={16} />}
              onClick={() => {
                void navigator.clipboard.writeText(address);
                setCopied(true);
              }}
            >
              {copied ? "Copied" : "Copy address"}
            </Button>
            <a
              href={`zcash:${address}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-strong font-semibold text-[15px] hover:bg-surface-2"
            >
              <ExternalLink size={16} /> Open in wallet
            </a>
          </div>
          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
          >
            <RefreshCw size={12} /> Another fresh address
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg bg-surface-2/60 p-4">
        {arrived ? (
          <TxSteps
            steps={[
              { label: "Deposit seen", state: "done", detail: `+${zec(arrived.delta)} ${UNIT}` },
              {
                label: spendable
                  ? "Spendable"
                  : arrived.minedHeight === null
                    ? "Waiting for a block"
                    : `${confirmations} of ${RECEIVED_CONFIRMATIONS} blocks`,
                state: spendable ? "done" : "active",
                detail: spendable ? undefined : `about ${minutesLeft} min`,
              },
              {
                label:
                  arrived.fromPublic === null
                    ? "Checking where it came from"
                    : arrived.fromPublic
                      ? "From a public address: rests 2–6 h before it can fund a wallet"
                      : "Fully shielded: no rest",
                state: arrived.fromPublic === null ? "active" : "done",
              },
            ]}
          />
        ) : (
          <Wait verb="Waiting for your deposit" />
        )}
      </div>

      <div className="flex gap-3 text-[13px] text-ink-2">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-up" />
        <p>
          From a shielded wallet (Zodl, Zashi, Ywallet) it is spendable after {RECEIVED_CONFIRMATIONS} blocks, about{" "}
          {SPENDABLE_MINUTES} minutes. From an exchange or a transparent address it rests 2–6 hours more, so its arrival
          can't be matched to your next trade.
        </p>
      </div>
    </Drawer>
  );
}
