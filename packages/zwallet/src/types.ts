export type Network = "main" | "test";

/** One pool's balance, in zatoshis. */
export interface PoolBalance {
  spendable: number;
  pendingChange: number;
  pendingSpendable: number;
  locked: number;
}

export interface Balance {
  ironwood: PoolBalance;
  orchard: PoolBalance;
  sapling: PoolBalance;
  total: number;
}

export interface Summary {
  tip: number | null;
  scanned: number | null;
  birthday: number | null;
  fullyScanned?: number;
  progress?: { done: number; total: number };
  balance: Balance | null;
}

export interface ScanRange {
  start: number;
  end: number;
  priority: string;
}

export interface Proposal {
  id: number;
  fee: number;
  minTargetHeight: number;
  transparent: boolean;
}

export interface Built {
  txid: string;
  raw: string;
}

/** Progress events the worker sends while syncing. */
export interface SyncProgress {
  tip: number;
  scannedTo: number;
  remainingBlocks: number;
  received: number;
}

/** Messages from the main thread to the wallet worker. */
export type Request =
  | { id: number; kind: "open"; network: Network; relay: string; wasmUrl: string; saved?: Uint8Array }
  | { id: number; kind: "create"; seedHex: string; birthday?: number }
  | { id: number; kind: "sync" }
  | { id: number; kind: "summary" }
  | { id: number; kind: "freshAddress" }
  | { id: number; kind: "warmProver" }
  | { id: number; kind: "send"; to: string; zat: number; seedHex: string }
  | { id: number; kind: "propose"; to: string; zat: number };

/** Messages from the worker back to the main thread. */
export type Response =
  | { id: number; ok: unknown }
  | { id: number; error: string }
  | { event: "progress"; progress: SyncProgress }
  | { event: "persist"; bytes: Uint8Array };
