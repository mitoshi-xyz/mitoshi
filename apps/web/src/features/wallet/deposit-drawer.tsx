"use client";

import { BLOCK_SECONDS as SPACING } from "@mitoshi/engine";
import { type HistoryEntry, RECEIVED_CONFIRMATIONS, ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { Drawer, Segmented, TxSteps, Wait } from "@/kit";
import { AddressCard } from "./address-card";
import { ExchangeDeposit } from "./exchange-tab";
import { freshAddress, useWallet } from "./wallet-store";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 8;
const SECONDS_PER_MINUTE = 60;
const BLOCK_SECONDS = SPACING[ZEC_NETWORK];
/** Ten blocks at the network's spacing, rounded: what the copy promises before a deposit is spendable. */
const SPENDABLE_MINUTES = Math.round((RECEIVED_CONFIRMATIONS * BLOCK_SECONDS) / SECONDS_PER_MINUTE);

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");
/** What moving an exchange deposit into the shielded pool costs (ZIP 317: one transparent input, two actions). */
const SHIELD_FEE_ZAT = 15_000;

type From = "wallet" | "exchange";
const FROM = [
  { value: "wallet", label: "Shielded wallet" },
  { value: "exchange", label: "Exchange" },
] as const;

/**
 * Deposit, from a shielded wallet (a shielded address) or from an exchange (a transparent one Mitoshi shields). Opened
 * with an amount (a funding that needs more), it says how much to send, and the shielded QR asks for exactly that.
 */
export function DepositDrawer({
  open,
  onClose,
  amountZat = null,
}: {
  open: boolean;
  onClose: () => void;
  amountZat?: number | null;
}) {
  const [from, setFrom] = useState<From>("wallet");
  // An exchange deposit pays the move into the shielded pool, so it has to bring that much more.
  const send = amountZat === null ? null : from === "wallet" ? amountZat : amountZat + SHIELD_FEE_ZAT;
  return (
    <Drawer open={open} onClose={onClose} title={`Deposit ${UNIT}`}>
      <Segmented options={FROM} value={from} onChange={setFrom} className="self-center" />
      {send === null ? null : (
        <p className="num rounded-lg bg-accent-wash px-4 py-3 text-center font-semibold text-[15px]">
          Send {from === "exchange" ? "at least " : ""}
          {zec(send)} {UNIT}
        </p>
      )}
      {from === "wallet" ? (
        <ShieldedDeposit open={open} amount={amountZat === null ? undefined : zec(amountZat)} />
      ) : (
        <ExchangeDeposit open={open} unit={UNIT} />
      )}
    </Drawer>
  );
}

/**
 * From a shielded wallet: a never-used shielded address as a dotted QR, and the deposit followed live: seen in a
 * block, counted to the 10 confirmations the wallet needs, then where it came from.
 */
function ShieldedDeposit({ open, amount }: { open: boolean; amount?: string | undefined }) {
  const w = useWallet();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seenAtOpen = useRef<Set<string>>(new Set());

  const next = () => {
    setAddress(null);
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
    <>
      <AddressCard
        address={address}
        error={error}
        onFresh={next}
        freshLabel="Another fresh address"
        openInWallet
        loading="Making a fresh address"
        {...(amount ? { amount } : {})}
      />

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
          From Zodl, Zashi or Ywallet it is spendable after {RECEIVED_CONFIRMATIONS} blocks, about {SPENDABLE_MINUTES}{" "}
          minutes. Sending from an exchange? Use Exchange.
        </p>
      </div>
    </>
  );
}
