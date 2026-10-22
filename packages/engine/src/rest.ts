import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { REST_MAX_MS, REST_MIN_MS, UNKNOWN_ORIGIN_HOLD_BLOCKS } from "./constants.ts";

const MS_PER_SECOND = 1000;
const UINT32_BITS = 32;
const UINT32_RANGE = 2 ** UINT32_BITS;
const DOMAIN = new TextEncoder().encode("mitoshi/rest/v1");

export interface RestNote {
  txid: string;
  pool: "orchard" | "ironwood";
  index: number;
  minedHeight: number | null;
  origin: "public" | "shielded" | "unknown";
}

export type RestRef = Pick<RestNote, "txid" | "pool" | "index">;

export interface RestPlan {
  /** Notes to lock until a height (re-locking at the same height is a no-op). */
  lock: { notes: RestRef[]; untilHeight: number }[];
  /** Notes that turned out fully shielded: lift any hold. */
  unlock: RestRef[];
}

/** The device's rest key: HMAC-SHA256(seed, domain). Never leaves the browser. */
export function restKey(seed: Uint8Array): Uint8Array {
  return hmac(sha256, seed, DOMAIN);
}

/**
 * How many blocks one note rests: uniform over [2 h, 6 h], derived from the note and the device's
 * rest key. Deterministic, so the engine can re-plan on every sync without storing anything, and
 * unpredictable to anyone without the key.
 */
export function restBlocks(key: Uint8Array, ref: RestRef, blockSeconds: number): number {
  const mac = hmac(sha256, key, new TextEncoder().encode(`${ref.txid}:${ref.pool}:${ref.index}`));
  const u = new DataView(mac.buffer, mac.byteOffset, mac.byteLength).getUint32(0) / UINT32_RANGE;
  const ms = REST_MIN_MS + (REST_MAX_MS - REST_MIN_MS) * u;
  return Math.ceil(ms / (blockSeconds * MS_PER_SECOND));
}

/**
 * The rest rules: fully shielded value is usable at once; value from a public address rests
 * 2–6 hours from the block it was mined in; value of unknown origin is held a few blocks at a time
 * until its full transaction is known.
 */
export function planRest(notes: RestNote[], tip: number, key: Uint8Array, blockSeconds: number): RestPlan {
  const byHeight = new Map<number, RestRef[]>();
  const unlock: RestRef[] = [];
  for (const n of notes) {
    const ref = { txid: n.txid, pool: n.pool, index: n.index };
    if (n.origin === "shielded") {
      unlock.push(ref);
      continue;
    }
    if (n.minedHeight === null) continue;
    const until =
      n.origin === "public" ? n.minedHeight + restBlocks(key, ref, blockSeconds) : tip + UNKNOWN_ORIGIN_HOLD_BLOCKS;
    if (until <= tip) continue;
    const list = byHeight.get(until) ?? [];
    list.push(ref);
    byHeight.set(until, list);
  }
  return { lock: [...byHeight].map(([untilHeight, refs]) => ({ notes: refs, untilHeight })), unlock };
}

/** When a resting note becomes usable, given the current tip (an estimate from block spacing). */
export function restEndsAt(untilHeight: number, tip: number, now: number, blockSeconds: number): number {
  return now + Math.max(0, untilHeight - tip + 1) * blockSeconds * MS_PER_SECOND;
}
