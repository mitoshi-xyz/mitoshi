/**
 * Desk setup runs a treasury and six desks side by side on a developer machine, each in its own frame. A frame's
 * window name says which one it is, and its vault lives in a database of its own, so the seven wallets never touch.
 * Production builds have no slots: there the vault is always the one database.
 */
const SLOT_NAME = /^mitoshi-slot:([a-z0-9-]+)$/;

export function setupSlot(): string | null {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return null;
  return SLOT_NAME.exec(window.name)?.[1] ?? null;
}

export const slotWindowName = (slot: string) => `mitoshi-slot:${slot}`;
