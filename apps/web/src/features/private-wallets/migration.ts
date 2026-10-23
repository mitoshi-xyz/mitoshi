"use client";

import { type MigrationPart, migrationParts, migrationSchedule, transferDelay } from "@mitoshi/engine";
import { migrate, walletState } from "../wallet/wallet-store";
import { currentRegistry, mutate } from "./registry-store";

/** A part that fails this often (its note still resting, or change not confirmed yet) stops and says why. */
const MAX_ATTEMPTS = 3;

/** What moving the Orchard notes across would take now: the parts, and what stays behind as the residual. */
export function migrationPlan(): { parts: number[]; residual: number } {
  return migrationParts(
    walletState()
      .notes.filter((n) => n.pool === "orchard")
      .map((n) => n.value),
  );
}

/** The user agreed to the whole schedule (ZIP 318 asks for that before anything is sent): each part waits its turn. */
export function startMigration(parts: number[]) {
  const plan = migrationSchedule(parts, Date.now());
  mutate((r) => ({ ...r, migration: plan.map((p) => ({ ...p, status: "waiting" as const })) }));
}

/** Drops a finished or stopped migration from the list. */
export function clearMigration() {
  mutate(({ migration: _done, ...r }) => r);
}

function patch(index: number, change: Partial<MigrationPart>) {
  mutate((r) => ({
    ...r,
    ...(r.migration ? { migration: r.migration.map((p, i) => (i === index ? { ...p, ...change } : p)) } : {}),
  }));
}

let sending = false;

/**
 * Runs from the jobs tick. Parts that came due while the app was closed get new random times, so none goes out
 * because the app opened; otherwise the one due part is sent, alone.
 */
export function migrationTick(now: number, sessionStart: number) {
  const parts = currentRegistry().migration;
  if (!parts || sending) return;
  if (parts.some((p) => p.status === "waiting" && p.at < sessionStart)) {
    const migration: MigrationPart[] = [];
    let at = now;
    for (const p of parts) {
      if (p.status !== "waiting" || p.at >= sessionStart) migration.push(p);
      else {
        at += transferDelay();
        migration.push({ ...p, at });
      }
    }
    mutate((r) => ({ ...r, migration }));
    return;
  }
  const due = parts.findIndex((p) => p.status === "waiting" && p.at <= now);
  const part = parts[due];
  if (!part) return;
  sending = true;
  migrate(part.zat)
    .then(
      ({ txid }) => patch(due, { status: "sent", txid }),
      (e: unknown) => {
        const attempts = (part.attempts ?? 0) + 1;
        const error = e instanceof Error ? e.message : String(e);
        patch(
          due,
          attempts >= MAX_ATTEMPTS
            ? { status: "failed", error, attempts }
            : { at: Date.now() + transferDelay(), attempts },
        );
      },
    )
    .finally(() => {
      sending = false;
    });
}
