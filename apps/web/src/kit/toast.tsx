"use client";

import { CheckCircle2, ChevronRight, CircleAlert, Info } from "lucide-react";
import { useRef, useSyncExternalStore } from "react";
import { cx } from "./cx";
import { type Cue, cue } from "./feedback";

/**
 * Toasts: one short line for something that finished somewhere else (a deposit arrived, a wallet got ready, money came
 * home), and at most one detail. One shows at a time, at the top of a phone under the status bar like the system's own
 * banners, and under the top line on a desktop. A tap opens what it is about (its receipt or its page); a swipe up or
 * five seconds put it away, and the notification list keeps it.
 */
export interface Toast {
  id: string;
  tone: "up" | "info" | "down";
  title: string;
  body?: string;
  /** A page to open on a tap. */
  href?: string;
  /** A transaction of the shielded wallet whose receipt a tap opens. */
  receipt?: string;
}

const TTL_MS = 5_000;
const SWIPE_PX = 24;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

const SOUND: Record<Toast["tone"], Cue> = { up: "arrive", info: "tap", down: "error" };

const sinks = new Set<(t: Toast) => void>();

/** Hears every toast as it is raised (the notification list keeps them after they leave the screen). */
export function onToast(sink: (t: Toast) => void): () => void {
  sinks.add(sink);
  return () => sinks.delete(sink);
}

let opener: ((t: Pick<Toast, "href" | "receipt">) => void) | null = null;

/** What a tap on a toast does: the shell opens the receipt or the page (the kit knows neither). */
export function onToastOpen(open: (t: Pick<Toast, "href" | "receipt">) => void): () => void {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
}

export function toast(t: Omit<Toast, "id">) {
  const id = crypto.randomUUID();
  toasts = [{ ...t, id }];
  emit();
  for (const sink of sinks) sink({ ...t, id });
  cue(SOUND[t.tone]);
  setTimeout(() => dismiss(id), TTL_MS);
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const ICON = { up: CheckCircle2, info: Info, down: CircleAlert };
const TONE = { up: "bg-up-wash text-up", info: "bg-surface-3 text-ink-2", down: "bg-down/15 text-down" };

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  const startY = useRef<number | null>(null);
  const t = list[0];
  if (!t) return <div aria-live="polite" className="sr-only" />;
  const Icon = ICON[t.tone];
  const opens = t.receipt !== undefined || t.href !== undefined;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+8px)] z-[var(--z-toast)] flex justify-center px-4 md:inset-x-auto md:top-20 md:right-6 md:px-0"
    >
      <button
        key={t.id}
        type="button"
        onClick={() => {
          dismiss(t.id);
          if (opens) opener?.(t);
        }}
        onTouchStart={(e) => {
          startY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const end = e.changedTouches[0]?.clientY;
          if (startY.current !== null && end !== undefined && startY.current - end > SWIPE_PX) dismiss(t.id);
          startY.current = null;
        }}
        className="pointer-events-auto flex w-full max-w-[384px] items-center gap-3 rounded-2xl bg-surface-2 py-2.5 pr-3 pl-2.5 text-left shadow-[var(--shadow-receipt)] [animation:mt-toast-in_var(--dur-drawer-in)_var(--ease-drawer)_both]"
      >
        <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-full", TONE[t.tone])}>
          <Icon size={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-[14px]">{t.title}</span>
          {t.body ? <span className="num truncate text-[12px] text-ink-2">{t.body}</span> : null}
        </span>
        {opens ? <ChevronRight size={16} className="shrink-0 text-muted" /> : null}
      </button>
    </div>
  );
}
