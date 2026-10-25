"use client";

import type { Notice, Registry } from "@mitoshi/engine";
import type { Toast } from "@/kit";
import { mutate } from "../private-wallets/registry-store";

/** Older notifications drop off the end; the list is a recent history, not an archive. */
const KEEP = 60;

/** Keeps a toast in the notification list (in the encrypted vault, on this device only). */
export function recordNotice(t: Toast) {
  const notice: Notice = {
    id: t.id,
    tone: t.tone,
    title: t.title,
    at: Date.now(),
    ...(t.body ? { body: t.body } : {}),
    ...(t.action ? { href: t.action.href } : {}),
  };
  mutate((r) => ({ ...r, notices: [notice, ...(r.notices ?? [])].slice(0, KEEP) }));
}

export function markNoticesSeen() {
  mutate((r) => ({ ...r, noticesSeenAt: Date.now() }));
}

export function clearNotices() {
  mutate(({ notices: _gone, ...r }) => ({ ...r, noticesSeenAt: Date.now() }));
}

export function unseenCount(r: Registry): number {
  const seen = r.noticesSeenAt ?? 0;
  return (r.notices ?? []).filter((n) => n.at > seen).length;
}
