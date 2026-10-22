"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

type Tone = "primary" | "secondary" | "ghost" | "up" | "down";
type Size = "sm" | "md" | "lg" | "cta";

const TONES: Record<Tone, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 active:bg-accent-press",
  secondary: "border border-strong bg-surface-1 text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-1 hover:text-ink",
  up: "border border-up/40 bg-up-wash text-up hover:border-up",
  down: "border border-down/40 bg-down-wash text-down hover:border-down",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-full px-3 text-[13px]",
  md: "h-10 gap-2 rounded-full px-4 text-sm",
  lg: "h-12 gap-2 rounded-md px-5 text-[15px] font-semibold",
  cta: "h-[52px] w-full gap-2 rounded-lg px-5 type-cta",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  size?: Size;
  icon?: ReactNode;
}

/** Mitoshi's button: vermilion primary (48 px), the 52 px ticket CTA, pills for chrome. */
export function Button({
  tone = "secondary",
  size = "md",
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex select-none items-center justify-center font-medium transition-[background-color,border-color,filter,color] duration-[var(--dur-hover)] disabled:cursor-not-allowed disabled:opacity-40",
        TONES[tone],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
