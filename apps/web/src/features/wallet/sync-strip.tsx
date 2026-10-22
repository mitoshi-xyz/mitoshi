"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { useRef, useState } from "react";
import { WALLET_SYNC_INTERVAL_MS } from "@/constants";
import { LiveDot } from "@/kit";
import { refreshWallet, type WalletState } from "./wallet-store";

const PERCENT = 100;
const MS_PER_SECOND = 1000;

/**
 * Where the wallet is with the chain: scanning (with a bar measured against the blocks this sync
 * started with), a failed round (why, and a retry; the balance above stays valid), or up to date.
 */
export function SyncStrip({ state }: { state: WalletState }) {
  const started = useRef(0);
  const [retrying, setRetrying] = useState(false);
  const p = state.progress;
  if (!p || p.remainingBlocks === 0) started.current = 0;
  else started.current = Math.max(started.current, p.remainingBlocks);

  if (p && p.remainingBlocks > 0) {
    const done = 1 - p.remainingBlocks / Math.max(started.current, 1);
    return (
      <div className="flex items-center gap-3 text-[13px] text-ink-2">
        <LiveDot tone="accent" />
        <span>
          Scanning privately · <span className="num">{p.remainingBlocks.toLocaleString()}</span> blocks left
        </span>
        <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-1">
          <span
            className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-[var(--dur-state)]"
            style={{ width: `${Math.round(done * PERCENT)}%` }}
          />
        </span>
      </div>
    );
  }

  if (state.syncError) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[13px]">
        <AlertTriangle size={15} className="text-warning" />
        <span className="font-medium">Couldn't reach the Zcash network</span>
        <span className="min-w-0 flex-1 truncate text-ink-2" title={state.syncError}>
          The balance above is from the last good sync. Trying again every {WALLET_SYNC_INTERVAL_MS / MS_PER_SECOND} s.
        </span>
        <button
          type="button"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            void refreshWallet().finally(() => setRetrying(false));
          }}
          className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline disabled:opacity-60"
        >
          <RotateCw size={13} className={retrying ? "animate-spin" : ""} /> {retrying ? "Retrying" : "Retry now"}
        </button>
      </div>
    );
  }

  if (!state.summary?.tip) return null;
  return (
    <div className="flex items-center gap-3 text-[13px] text-ink-2">
      <LiveDot />
      <span>
        Up to date at block <span className="num">{state.summary.tip.toLocaleString()}</span> · checks every{" "}
        {WALLET_SYNC_INTERVAL_MS / MS_PER_SECOND} s, over OHTTP
      </span>
    </div>
  );
}
