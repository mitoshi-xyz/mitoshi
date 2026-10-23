"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SETTLE_MS = 220;
/** A navigation that takes longer than this is no longer "instant": the bar shows. */
const SHOW_AFTER_MS = 80;

/**
 * A thin vermilion line under the top edge while a page loads: it starts on any click to another page of the app and
 * fills when the new page is in, so a tap always answers at once.
 */
export function RouteProgress() {
  const path = usePathname();
  const [state, setState] = useState<"idle" | "going" | "done">("idle");
  const show = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const to = new URL(a.href, window.location.href);
      if (to.origin !== window.location.origin || to.pathname === window.location.pathname) return;
      if (show.current) clearTimeout(show.current);
      show.current = setTimeout(() => setState("going"), SHOW_AFTER_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Runs when the page changes (path is the trigger, not a value read here).
  useEffect(() => {
    if (show.current) clearTimeout(show.current);
    show.current = null;
    setState((s) => (s === "going" ? "done" : "idle"));
    const t = setTimeout(() => setState("idle"), SETTLE_MS);
    return () => clearTimeout(t);
  }, [path]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[var(--z-toast)] h-[3px]">
      <div
        className="h-full bg-accent shadow-[0_0_8px_var(--accent)]"
        style={{
          width: state === "idle" ? "0%" : state === "going" ? "70%" : "100%",
          opacity: state === "idle" ? 0 : 1,
          transition:
            state === "going"
              ? "width 8s cubic-bezier(0.1, 0.7, 0.2, 1), opacity 120ms"
              : "width 200ms ease-out, opacity 200ms 120ms",
        }}
      />
    </div>
  );
}
