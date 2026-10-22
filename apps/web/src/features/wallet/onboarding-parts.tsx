"use client";

import { ChevronLeft } from "lucide-react";
import { cx } from "@/kit";
import type { WalletState } from "./wallet-store";

const BYTES_PER_MB = 1_048_576;
const MB_DIGITS = 1;
const PERCENT = 100;
const STEPS = [1, 2];

const mb = (bytes: number) => (bytes / BYTES_PER_MB).toFixed(MB_DIGITS);

/** The wallet engine's download, while it runs: it loads while the story plays and the words are written down. */
export function EngineLine({ w }: { w: WalletState }) {
  if (w.phase !== "idle" && w.phase !== "loading") return null;
  const e = w.engine;
  return (
    <div className="flex flex-col gap-1.5 pt-1 text-[12px] text-muted">
      <span className="flex justify-between">
        <span>Getting the wallet engine ready</span>
        <span className="num">
          {e ? (e.total ? `${mb(e.loaded)} of ${mb(e.total)} MB` : `${mb(e.loaded)} MB`) : ""}
        </span>
      </span>
      <span className="relative h-0.5 overflow-hidden rounded-full bg-surface-2">
        <span
          className={cx(
            "absolute inset-y-0 left-0 bg-accent transition-[width] duration-[var(--dur-state)]",
            e?.total ? "" : "w-1/3 [animation:mt-shimmer_1.6s_linear_infinite]",
          )}
          style={e?.total ? { width: `${Math.round((e.loaded / e.total) * PERCENT)}%` } : undefined}
        />
      </span>
    </div>
  );
}

/** A step's frame: back, where you are, then the step. */
export function Step({
  n,
  title,
  onBack,
  children,
}: {
  n?: number;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="flex size-9 items-center justify-center rounded-full text-ink-2 hover:bg-surface-1 hover:text-ink"
        >
          <ChevronLeft size={20} />
        </button>
        {n ? (
          <span className="flex flex-1 gap-1.5">
            {STEPS.map((i) => (
              <span key={i} className={cx("h-1 flex-1 rounded-full", i <= n ? "bg-accent" : "bg-surface-2")} />
            ))}
          </span>
        ) : null}
      </div>
      <h1 className="type-heading">{title}</h1>
      {children}
    </div>
  );
}
