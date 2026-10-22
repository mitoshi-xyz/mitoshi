"use client";

import type { LucideIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "./button";
import { cx } from "./cx";

/** A placeholder shaped like what will be there (pulse 1200 ms). Never a spinner page, never an invented number. */
export function Skeleton({ className, label }: { className?: string; label?: string }) {
  const cls = cx("rounded-md bg-surface-1 [animation:mt-pulse_1200ms_var(--ease)_infinite]", className);
  return label ? <div role="status" aria-label={label} className={cls} /> : <div aria-hidden className={cls} />;
}

/** Why it is empty, and the one thing to do about it. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-1 text-ink-2">
        <Icon size={22} strokeWidth={1.75} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {body ? <p className="max-w-sm text-[13px] text-ink-2">{body}</p> : null}
      </div>
      {action ? (
        action.href ? (
          <a href={action.href} className="text-accent text-sm hover:underline">
            {action.label}
          </a>
        ) : (
          <Button size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}

const SHOW_ELAPSED_AFTER_S = 3;
const STILL_WAITING_AFTER_S = 15;
const TICK_MS = 1000;

/**
 * A wait in words: a shimmering verb ("Pricing", "Making the private proof"), the seconds after 3 s, and
 * "Still waiting · Retry" after 15 s (Kawase's wait grammar).
 */
export function Wait({ verb, onRetry, expectSeconds }: { verb: string; onRetry?: () => void; expectSeconds?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / TICK_MS)), TICK_MS);
    return () => clearInterval(t);
  }, []);
  const late = elapsed >= (expectSeconds ? expectSeconds * 2 : STILL_WAITING_AFTER_S);
  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <span className="bg-[linear-gradient(90deg,var(--ink-2)_0%,var(--ink)_50%,var(--ink-2)_100%)] bg-[length:200%_100%] bg-clip-text text-transparent [animation:mt-shimmer_1.6s_linear_infinite]">
        {verb}…
      </span>
      {elapsed >= SHOW_ELAPSED_AFTER_S ? <span className="num text-muted">{elapsed}s</span> : null}
      {late && onRetry ? (
        <button type="button" onClick={onRetry} className="text-accent hover:underline">
          Still waiting · Retry
        </button>
      ) : null}
    </span>
  );
}

/** A small pulsing dot for "live". */
export function LiveDot({ tone = "up" }: { tone?: "up" | "accent" | "muted" }) {
  const color = tone === "up" ? "bg-up" : tone === "accent" ? "bg-accent" : "bg-muted";
  return (
    <span className="relative inline-flex size-2">
      <span className={cx("absolute inset-0 rounded-full [animation:mt-ping_1.6s_var(--ease-out)_infinite]", color)} />
      <span className={cx("relative size-2 rounded-full", color)} />
    </span>
  );
}
