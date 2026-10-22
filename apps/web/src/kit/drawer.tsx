"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { cx } from "./cx";

/**
 * A right drawer on desktop (384 px, or 560 wide) and a bottom sheet on phones, over a scrim. Esc and the scrim close it.
 */
export function Drawer({
  open,
  onClose,
  title,
  wide = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className={cx("fixed inset-0 z-[var(--z-drawer)]", open ? "" : "pointer-events-none")} aria-hidden={!open}>
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
        role="dialog"
        aria-modal="true"
        className={cx(
          "absolute flex flex-col gap-4 overflow-y-auto border-hairline bg-surface-1 p-5 shadow-[var(--shadow-receipt)] transition-transform duration-[var(--dur-drawer-in)] [transition-timing-function:var(--ease-drawer)]",
          "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t",
          "md:inset-y-4 md:right-4 md:left-auto md:max-h-none md:rounded-xl md:border",
          wide ? "md:w-[560px]" : "md:w-[384px]",
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-x-[calc(100%+2rem)] md:translate-y-0",
        )}
      >
        <header className="flex items-center justify-between gap-3">
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
        {children}
      </section>
    </div>
  );
}
