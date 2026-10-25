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
  /** At a transparent receive address (an exchange deposit), not shielded yet. */
  transparent: PoolBalance;
  total: number;
}

/** What one check of a transparent address found, and what a shielding did. */
export interface UtxoCheck {
  stored: number;
  zat: number;
}
export interface Shielded {
  /** Null when there was too little at transparent addresses to be worth the fee. */
  txid: string | null;
  fee?: number;
  zat?: number;
}

export interface Summary {
  tip: number | null;
  scanned: number | null;
  birthday: number | null;
  fullyScanned?: number;
  progress?: { done: number; total: number };
  balance: Balance | null;
}

/** An unspent note and where its value came from (from a public address or fully shielded). */
export interface Note {
  txid: string;
  pool: "orchard" | "ironwood";
  index: number;
  value: number;
  minedHeight: number | null;
  change: boolean;
  origin: "public" | "shielded" | "unknown";
}

export type NoteRef = Pick<Note, "txid" | "pool" | "index">;

export interface HistoryEntry {
  txid: string;
  minedHeight: number | null;
  expiryHeight: number | null;
  /** Net change to the balance, in zatoshis (negative for sends, fee included). */
  delta: number;
  fee: number | null;
  /** Block time, seconds since the epoch. */
  time: number | null;
  expired: boolean;
  sentNotes: number;
  receivedNotes: number;
  /** A transfer between the wallet's own pools. */
  internal: boolean;
  /** Whether the transaction spent transparent inputs (null until the full transaction is known). */
  fromPublic: boolean | null;
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

/** How much of the wallet engine has downloaded; `total` is null when the server compresses it. */
export interface EngineLoad {
  loaded: number;
  total: number | null;
}

/** Messages from the main thread to the wallet worker. */
export type Request =
  | { id: number; kind: "open"; network: Network; relay: string; wasmUrl: string; saved?: Uint8Array }
  | { id: number; kind: "create"; seedHex: string; birthday?: number }
  | { id: number; kind: "sync" }
  | { id: number; kind: "summary" }
  | { id: number; kind: "freshAddress" }
  | { id: number; kind: "warmProver" }
  | { id: number; kind: "notes" }
  | { id: number; kind: "lockNotes"; notes: NoteRef[]; untilHeight: number }
  | { id: number; kind: "unlockNotes"; notes: NoteRef[] }
  | { id: number; kind: "history"; limit: number }
  | { id: number; kind: "send"; send: SendKind; to: string; zat: number; seedHex: string }
  | { id: number; kind: "propose"; send: SendKind; to: string; zat: number }
  | { id: number; kind: "transparentAddress" }
  | { id: number; kind: "transparentAddresses" }
  | { id: number; kind: "checkUtxos"; address: string }
  | { id: number; kind: "shield"; seedHex: string };

/**
 * A payment spends Ironwood only. A migration moves one standard amount of Orchard value into Ironwood as a ZIP 318
 * canonical crossing, to this account's own internal address (its `to` is ignored).
 */
export type SendKind = "pay" | "migrate";

/** Messages from the worker back to the main thread. */
export type Response =
  | { id: number; ok: unknown }
  | { id: number; error: string }
  | { event: "progress"; progress: SyncProgress }
  | { event: "load"; load: EngineLoad }
  | { event: "persist"; bytes: Uint8Array };
