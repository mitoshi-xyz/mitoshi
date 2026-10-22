"use client";

import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { cx } from "./cx";
import { type Cue, cue } from "./feedback";

/**
 * Toasts: one line for something that finished somewhere else (a wallet got ready, a deposit
 * arrived, money came home), with one action. They stack bottom-right (above the dock on phones)
 * and leave on their own.
 */
export interface Toast {
  id: string;
  tone: "up" | "info" | "down";
  title: string;
  body?: string;
  action?: { label: string; href: string };
}

const TTL_MS = 7_000;
const MAX = 3;
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

const SOUND: Record<Toast["tone"], Cue> = { up: "arrive", info: "tap", down: "error" };

export function toast(t: Omit<Toast, "id">) {
  const id = crypto.randomUUID();
  toasts = [{ ...t, id }, ...toasts].slice(0, MAX);
  emit();
  cue(SOUND[t.tone]);
  setTimeout(() => dismiss(id), TTL_MS);
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const ICON = { up: CheckCircle2, info: Info, down: CircleAlert };

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-28 z-[var(--z-toast)] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 md:bottom-6"
    >
      {list.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <li
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-3.5 shadow-[var(--shadow-receipt)] [animation:mt-toast-in_var(--dur-drawer-in)_var(--ease-drawer)_both]"
          >
            <Icon
              size={18}
              className={cx(
                "mt-0.5 shrink-0",
                t.tone === "up" ? "text-up" : t.tone === "down" ? "text-down" : "text-ink-2",
              )}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium text-[14px]">{t.title}</span>
              {t.body ? <span className="text-[13px] text-ink-2">{t.body}</span> : null}
              {t.action ? (
                <Link
                  href={t.action.href}
                  onClick={() => dismiss(t.id)}
                  className="mt-1 self-start font-medium text-[13px] text-accent hover:underline"
                >
                  {t.action.label}
                </Link>
              ) : null}
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="text-muted hover:text-ink"
            >
              <X size={15} />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
