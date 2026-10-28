"use client";

import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, DottedQr, Skeleton } from "@/kit";

const GROUP = 6;
const grouped = (a: string) => a.match(new RegExp(`.{1,${GROUP}}`, "g"))?.join(" ") ?? a;

/**
 * A deposit address as a dotted QR, grouped for reading aloud, with Copy and a way to get a fresh one. With an amount,
 * the QR and "Open in wallet" are a ZIP 321 payment request (zcash:<address>?amount=<ZEC>), so the wallet fills it in.
 */
export function AddressCard({
  address,
  error,
  onFresh,
  freshLabel,
  openInWallet = false,
  loading,
  amount,
}: {
  address: string | null;
  error: string | null;
  onFresh: () => void;
  freshLabel: string;
  openInWallet?: boolean;
  loading: string;
  /** ZEC, as a decimal string. */
  amount?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [address]);
  if (error) return <p className="text-[13px] text-down">{error}</p>;
  if (!address) return <Skeleton className="mx-auto h-[264px] w-[264px] rounded-xl" label={loading} />;
  const request = amount ? `zcash:${address}?amount=${amount}` : address;
  return (
    <div className="flex flex-col items-center gap-4">
      <DottedQr value={request} mark="/marks/venue-zcash.svg" />
      <p className="num break-all text-center text-[12px] text-ink-2 leading-relaxed">{grouped(address)}</p>
      <div className={openInWallet ? "grid w-full grid-cols-2 gap-2" : "grid w-full gap-2"}>
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
        {openInWallet ? (
          <a
            href={amount ? request : `zcash:${address}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-strong font-semibold text-[15px] hover:bg-surface-2"
          >
            <ExternalLink size={16} /> Open in wallet
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onFresh}
        className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink"
      >
        <RefreshCw size={12} /> {freshLabel}
      </button>
    </div>
  );
}
