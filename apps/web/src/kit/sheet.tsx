"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { cue } from "./feedback";

/**
 * A bottom sheet on phones (grab bar, rounded top, a footer pinned at the bottom) and a centred modal on wider screens
 * (440 px). Esc and the scrim close it. Its contents mount when it opens and unmount once it has gone.
 */
export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Pinned below the scrolling body (the CTA). */
  footer?: ReactNode;
  children: ReactNode;
  /** 520 px instead of 440 on wider screens (lists). */
  wide?: boolean;
}) {
  const [present, setPresent] = useState(open);
  const was = useRef(open);
  useEffect(() => {
    if (open) setPresent(true);
    if (open !== was.current) cue(open ? "open" : "close");
    was.current = open;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={cx("fixed inset-0 z-[var(--z-modal)]", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={cx(
          "absolute inset-0 bg-[var(--scrim)] transition-opacity duration-[var(--dur-drawer-in)]",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <section
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !open) setPresent(false);
        }}
        role="dialog"
        aria-modal="true"
        className={cx(
          "absolute flex max-h-[min(92dvh,calc(100dvh-env(safe-area-inset-top)-16px))] flex-col border-hairline bg-surface-1 shadow-[var(--shadow-receipt)]",
          "transition-[transform,opacity] duration-[var(--dur-drawer-in)] [transition-timing-function:var(--ease-drawer)]",
          "inset-x-0 bottom-0 rounded-t-[28px] border-t pb-[max(12px,env(safe-area-inset-bottom))]",
          "md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:rounded-[24px] md:border md:pb-0",
          wide ? "md:w-[520px]" : "md:w-[440px]",
          open
            ? "translate-y-0 opacity-100 md:-translate-y-1/2"
            : "translate-y-full md:-translate-y-[46%] md:opacity-0",
        )}
      >
        <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-surface-3 md:hidden" />
        {title !== undefined ? (
          <header className="flex shrink-0 items-center justify-between gap-3 px-5 pt-3 md:pt-5">
            <h2 className="type-title-lg">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-4 pb-4">
          {open || present ? children : null}
        </div>
        {footer && (open || present) ? <footer className="shrink-0 px-5 pb-3 md:pb-5">{footer}</footer> : null}
      </section>
    </div>
  );
}
