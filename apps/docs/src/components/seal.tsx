/** The Mitoshi mark: a horizon, a rising line, and the vermilion dot it reaches for. */
export function MitoshiMark({ className, dot = "var(--mt-accent)" }: { className?: string; dot?: string }) {
  return (
    <svg viewBox="0 0 248 248" className={className} aria-hidden fill="none">
      <path d="M36 200 H212" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
      <path d="M52 156 C 104 156, 132 92, 182 62" stroke="currentColor" strokeWidth="28" strokeLinecap="round" />
      <circle cx="200" cy="44" r="27" fill={dot} />
    </svg>
  );
}

/** The seal: the mark on a vermilion disc, as in the app's rail. */
export function Seal({ className = "size-7" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--mt-accent)] text-[#141210] ${className}`}
    >
      <MitoshiMark className="w-[58%]" dot="#f4eee3" />
    </span>
  );
}
