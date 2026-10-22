"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type StepState = "done" | "active" | "pending" | "failed";

export interface TxStep {
  label: string;
  state: StepState;
  /** A line under the label: an ETA, an amount, a txid. */
  detail?: ReactNode;
}

/** A money job's steps: a check when done, a pulse when active, a hollow ring when pending. */
export function TxSteps({ steps }: { steps: TxStep[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 ? (
            <span
              aria-hidden
              className={cx(
                "absolute top-6 left-[11px] h-[calc(100%-20px)] w-px",
                s.state === "done" ? "bg-up/50" : "bg-hairline",
              )}
            />
          ) : null}
          <span className="relative mt-0.5 flex size-[23px] shrink-0 items-center justify-center">
            {s.state === "done" ? (
              <span className="flex size-[23px] items-center justify-center rounded-full bg-up text-bg">
                <Check size={14} strokeWidth={3} />
              </span>
            ) : s.state === "failed" ? (
              <span className="flex size-[23px] items-center justify-center rounded-full bg-down text-bg">
                <X size={14} strokeWidth={3} />
              </span>
            ) : s.state === "active" ? (
              <>
                <span className="absolute size-[23px] rounded-full bg-accent/40 [animation:mt-ping_1.6s_var(--ease-out)_infinite]" />
                <span className="relative size-[13px] rounded-full bg-accent" />
              </>
            ) : (
              <span className="size-[13px] rounded-full border-2 border-strong" />
            )}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className={cx("text-sm", s.state === "pending" ? "text-muted" : "text-ink")}>{s.label}</span>
            {s.detail ? <span className="text-[13px] text-ink-2">{s.detail}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export type TxPhase = "idle" | "signing" | "sent" | "confirmed" | "failed";

const PHASE_FILL: Record<TxPhase, string> = {
  idle: "0%",
  signing: "33%",
  sent: "66%",
  confirmed: "100%",
  failed: "100%",
};

/**
 * The money CTA. It never looks disabled: when an action is blocked it wears the fix ("Deposit ZEC") and does it;
 * while working, a phase bar fills its bottom edge (⅓ signing, ⅔ sent, full confirmed).
 */
export function TxCta({
  label,
  phase = "idle",
  onClick,
  fix,
  tone = "primary",
}: {
  label: ReactNode;
  phase?: TxPhase;
  onClick: () => void;
  /** When the action cannot run yet: what fixes it, and doing that instead. */
  fix?: { label: string; onClick: () => void };
  tone?: "primary" | "up" | "down";
}) {
  const busy = phase === "signing" || phase === "sent";
  const fill = tone === "up" ? "bg-up text-bg" : tone === "down" ? "bg-down text-bg" : "bg-accent text-accent-ink";
  return (
    <button
      type="button"
      aria-busy={busy}
      onClick={() => (fix ? fix.onClick() : busy ? undefined : onClick())}
      className={cx(
        "relative h-[52px] w-full overflow-hidden rounded-lg type-cta transition-[filter] duration-[var(--dur-hover)] hover:brightness-110",
        fill,
      )}
    >
      <span className="relative z-[1]">{fix ? fix.label : label}</span>
      <span
        aria-hidden
        className={cx(
          "absolute bottom-0 left-0 h-1 transition-[width] duration-[var(--dur-pill)]",
          phase === "failed" ? "bg-down" : "bg-black/35",
        )}
        style={{ width: PHASE_FILL[phase] }}
      />
    </button>
  );
}
