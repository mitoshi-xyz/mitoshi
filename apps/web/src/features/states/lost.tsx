"use client";

import { ArrowRight, RotateCw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Seal } from "../shell/seal";

/**
 * A page that is not there, or broke: the seal, one big word, one line, and the way back. 見えない ("out of sight")
 * sits behind it, Mitoshi's 見通し ("a clear view") turned around.
 */
export function Lost({
  code,
  line,
  retry,
}: {
  code: ReactNode;
  line: string;
  /** For a page that broke: try it again instead of only leaving. */
  retry?: () => void;
}) {
  return (
    <section className="relative flex min-h-[70dvh] flex-col items-center justify-center gap-5 overflow-hidden text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute select-none whitespace-nowrap font-stamp text-[clamp(80px,22vw,260px)] text-ink/[0.04] leading-none"
      >
        見えない
      </span>
      <Seal size={56} />
      <h1 className="num relative font-semibold text-[clamp(56px,12vw,96px)] leading-none">{code}</h1>
      <p className="relative max-w-sm text-ink-2">{line}</p>
      <div className="relative flex gap-2">
        {retry ? (
          <button
            type="button"
            onClick={retry}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-ink hover:brightness-110"
          >
            <RotateCw size={16} /> Try again
          </button>
        ) : null}
        <Link
          href="/markets"
          className={
            retry
              ? "inline-flex h-11 items-center gap-2 rounded-full border border-strong px-5 font-semibold hover:bg-surface-2"
              : "inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 font-semibold text-accent-ink hover:brightness-110"
          }
        >
          Markets <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

const RELOADED = "mitoshi:chunk-reload";

/**
 * A build file from another deploy (the page was open while a new one went out) cannot load: reload once, which picks
 * up the new build. A second failure is a real error and is shown.
 */
export function recoverFromChunkError(error: Error): boolean {
  const chunk = error.name === "ChunkLoadError" || /Failed to load chunk|Loading chunk/i.test(error.message);
  if (!chunk) return false;
  try {
    if (sessionStorage.getItem(RELOADED)) return false;
    sessionStorage.setItem(RELOADED, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
