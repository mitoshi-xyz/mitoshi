import { cx } from "@/kit";

/** The Mitoshi mark: a horizon, a rising line, and the vermilion dot it reaches for. */
export function MitoshiMark({ className, dot = "var(--accent)" }: { className?: string; dot?: string }) {
  return (
    <svg viewBox="0 0 248 248" className={className} aria-hidden fill="none">
      <path d="M36 200 H212" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
      <path d="M52 156 C 104 156, 132 92, 182 62" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
      <circle cx="200" cy="44" r="27" fill={dot} />
    </svg>
  );
}

/** The seal: the mark on a vermilion disc (the rail head, the dock's centre). */
export function Seal({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-cream-ink",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <MitoshiMark className="w-[58%]" dot="var(--cream)" />
    </span>
  );
}
