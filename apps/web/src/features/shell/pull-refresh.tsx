"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cue } from "@/kit";
import { refreshWallet } from "../wallet/wallet-store";

/** How far the finger travels for each pixel the spinner moves, where a release refreshes, and how far it can go. */
const RESIST = 0.5;
const TRIGGER_PX = 72;
const MAX_PX = 110;
const SPIN_DEG_PER_PX = 3;
/**
 * A refresh shows for at least MIN (one deliberate beat, not a flicker) and at most MAX: slower data keeps loading
 * behind it rather than holding the spinner.
 */
const MIN_REFRESH_MS = 600;
const MAX_REFRESH_MS = 2_500;

interface NativeShell {
  ReactNativeWebView?: unknown;
}

/** Where the phone has no pull-to-refresh of its own: the Mitoshi app's web view, or the site added to a Home Screen. */
function fullScreen(): boolean {
  if (typeof window === "undefined") return false;
  const ios = (navigator as { standalone?: boolean }).standalone === true;
  return Boolean((window as NativeShell).ReactNativeWebView) || ios || matchMedia("(display-mode: standalone)").matches;
}

/** A touch on a chart, a field, an open sheet or a list already scrolled down is not a pull. */
function busyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest("canvas, input, textarea, select, [role=dialog], [data-no-pull]")) return true;
  for (let el: Element | null = target; el; el = el.parentElement) if (el.scrollTop > 0) return true;
  return false;
}

/**
 * Pull down at the top of a page to refresh: the wallet syncs and every live query refetches (no page reload, so the
 * wallet engine stays loaded). A haptic tick marks the point where letting go refreshes.
 */
export function PullToRefresh() {
  const queries = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!fullScreen()) return;
    let startY: number | null = null;
    let armed = false;
    let distance = 0;

    const refresh = async () => {
      busyRef.current = true;
      setBusy(true);
      setPull(TRIGGER_PX);
      const started = Date.now();
      await Promise.race([
        Promise.allSettled([refreshWallet(), queries.invalidateQueries()]),
        new Promise((r) => setTimeout(r, MAX_REFRESH_MS)),
      ]);
      await new Promise((r) => setTimeout(r, Math.max(0, MIN_REFRESH_MS - (Date.now() - started))));
      cue("tap");
      busyRef.current = false;
      setBusy(false);
      setPull(0);
    };
    const start = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (busyRef.current || window.scrollY > 0 || e.touches.length !== 1 || !touch || busyTarget(e.target)) return;
      startY = touch.clientY;
      armed = false;
      distance = 0;
    };
    const move = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (startY === null || !touch) return;
      distance = Math.min(MAX_PX, Math.max(0, (touch.clientY - startY) * RESIST));
      setPull(distance);
      if (!armed && distance >= TRIGGER_PX) {
        armed = true;
        cue("tap");
      } else if (armed && distance < TRIGGER_PX) armed = false;
    };
    const end = () => {
      if (startY === null) return;
      startY = null;
      if (distance >= TRIGGER_PX) void refresh();
      else setPull(0);
      distance = 0;
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    window.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [queries]);

  if (pull === 0 && !busy) return null;
  return (
    <div
      role="status"
      aria-label={busy ? "Refreshing" : "Pull to refresh"}
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-[var(--z-toast)] flex justify-center"
      style={{ transform: `translateY(${pull - TRIGGER_PX / 2}px)`, opacity: Math.min(1, pull / TRIGGER_PX) }}
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-hairline bg-surface-1 text-ink shadow-[var(--shadow-receipt)]">
        <RefreshCw
          size={18}
          className={busy ? "animate-spin" : undefined}
          style={busy ? undefined : { transform: `rotate(${pull * SPIN_DEG_PER_PX}deg)` }}
        />
      </span>
    </div>
  );
}
