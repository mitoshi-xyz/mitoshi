import type { WalletStatus } from "@mitoshi/engine";
import type { WalletPhase } from "../../wallet/wallet-store";

/**
 * How the desk-setup console talks to its six desk frames (same origin, one BroadcastChannel). The console only
 * asks; each desk does its own work with its own wallet, the way the app does for anyone.
 */
export const SETUP_CHANNEL = "mitoshi-desk-setup";

export interface DeskStatus {
  kind: "status";
  n: number;
  phase: WalletPhase;
  /** A shielded address of this desk, for the treasury to pay. */
  address: string | null;
  spendable: number;
  confirming: number;
  resting: number;
  /** The desk's Hyperliquid wallet, once there is one. */
  ready: { status: WalletStatus; address: string; sizeZat: number; error?: string } | null;
  tip: number | null;
  error: string | null;
}

export interface DeskSealed {
  kind: "sealed";
  n: number;
  /** The sealed desk file, base64. */
  file: string;
  hyperliquid: string;
}

export type ToDesk = { kind: "fund"; n: number } | { kind: "seal"; n: number; key: string } | { kind: "ping" };
export type FromDesk = DeskStatus | DeskSealed | { kind: "failed"; n: number; error: string };
