"use client";

import { ZAT_PER_ZEC } from "@mitoshi/engine";
import { AlertTriangle, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { TxSteps } from "@/kit";
import { useRegistry } from "../private-wallets/registry-store";
import { AddressCard } from "./address-card";
import { checkSoon, exchangeAddress, freshExchangeAddress } from "./exchange";

const ZEC_DIGITS = 8;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

/** A wallet made before exchange deposits existed has no transparent keys; restoring it from its words adds them. */
function explain(e: unknown): string {
  const why = e instanceof Error ? e.message : String(e);
  return /ReceiverTypeNotSupported|P2pkh/.test(why)
    ? "This wallet was made before exchange deposits. Restore it from your 24 words (Settings, then Forget and restore) to turn them on."
    : why;
}

/**
 * Deposit from an exchange: exchanges pay only transparent addresses, so this is a fresh transparent address of the
 * wallet. What lands there is moved into the shielded pool by itself, then rests like any public deposit.
 */
export function ExchangeDeposit({ open, unit }: { open: boolean; unit: string }) {
  const registry = useRegistry();
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = (make: () => Promise<{ address: string }>) => {
    setAddress(null);
    setError(null);
    make().then(
      (a) => setAddress(a.address),
      (e: unknown) => setError(explain(e)),
    );
  };

  useEffect(() => {
    if (!open) return;
    show(exchangeAddress);
    checkSoon();
  }, [open]);

  const record = registry.exchange?.find((a) => a.address === address);
  const arrived = record?.arrivedZat;
  const shielded = record?.shieldTx !== undefined;

  return (
    <>
      {ZEC_NETWORK === "main" ? null : (
        <p className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 font-medium text-[13px] text-warning">
          <AlertTriangle size={16} className="shrink-0" /> Test network address: never send real ZEC here.
        </p>
      )}
      <AddressCard
        address={address}
        error={error}
        onFresh={() => show(freshExchangeAddress)}
        freshLabel="New address"
        loading="Making an exchange address"
      />
      <div className="flex flex-col gap-3 rounded-lg bg-surface-2/60 p-4">
        <TxSteps
          steps={[
            {
              label: arrived ? "Arrived from your exchange" : "Waiting for your exchange",
              state: arrived ? "done" : "active",
              detail: arrived ? `+${zec(arrived)} ${unit}` : `Withdraw ${unit} on the Zcash network`,
            },
            ...(record?.error
              ? [{ label: "Couldn't check just now", state: "failed" as const, detail: record.error }]
              : []),
            {
              label: shielded ? "Moved into the shielded pool" : "Moving into the shielded pool",
              state: shielded ? "done" : arrived ? "active" : "pending",
              detail: arrived && !shielded ? "A few minutes after it lands" : undefined,
            },
            {
              label: "Spendable, after a 2–6 h rest",
              state: shielded ? "active" : "pending",
            },
          ]}
        />
      </div>
      <div className="flex gap-3 text-[13px] text-ink-2">
        <Building2 size={18} className="mt-0.5 shrink-0 text-ink-2" />
        <p>
          Exchanges pay only addresses like this one. Mitoshi moves what lands into the shielded pool for you; it rests
          2–6 hours, so it can't be matched to your next trade.
        </p>
      </div>
    </>
  );
}
