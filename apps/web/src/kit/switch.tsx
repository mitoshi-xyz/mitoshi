"use client";

import { cx } from "./cx";
import { cue } from "./feedback";

/** An on/off switch (role="switch"), vermilion when on. */
export function Switch({
  on,
  onChange,
  label,
  disabled = false,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        cue("tap");
        onChange(!on);
      }}
      className={cx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--dur-state)] disabled:opacity-40",
        on ? "bg-accent" : "bg-surface-3",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform duration-[var(--dur-state)]",
          on ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
