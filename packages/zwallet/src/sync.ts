import type { PrivateFetch } from "@mitoshi/net";
import { BIRTHDAY_LOOKBACK_BLOCKS, MAX_REORG_REWINDS, SCAN_BATCH_BLOCKS, SUBTREE_PROTOCOLS } from "./constants";
import type { CoreModule } from "./core";
import { lwdCall } from "./grpc-web";
import {
  addressUtxosArg,
  blockId,
  blockIdHeight,
  blockRange,
  framed,
  rawTransaction,
  rawTransactionReply,
  sendResponse,
  subtreeRootsArg,
  txFilter,
} from "./proto";
import type { ScanRange, SyncProgress } from "./types";

const DONE = new Set(["Scanned", "Ignored"]);

type ScanResult = { received: number } | { reorg: { at: number; rewoundTo: number } };

/** gRPC NOT_FOUND, as lightwalletd reports an unknown txid. */
const NOT_FOUND = /grpc-status:?\s*5\b/;

/** RawTransaction.height for a transaction mined outside the main chain (2^64 - 1). */
const OFF_MAIN_CHAIN = 0xffff_ffff_ffff_ffffn;

/** Data requests handled per sync, so one bad transaction cannot stall the loop. */
const MAX_DATA_REQUESTS = 50;

interface DataRequest {
  kind: "status" | "enhance";
  txid: string;
}

/**
 * Fetches the full transactions the wallet asks for (new notes, our own sends awaiting mining)
 * and stores them. This is how a note's origin (shielded or public) and a send's confirmation
 * become known; compact blocks carry neither.
 */
export async function enhance(core: CoreModule, lwd: Lwd): Promise<number> {
  const requests = core.call<DataRequest[]>("dataRequests").slice(0, MAX_DATA_REQUESTS);
  let stored = 0;
  for (const r of requests) {
    const tx = await lwd.transaction(r.txid);
    if (!tx) {
      core.call("txStatus", { txid: r.txid, status: "unknown" });
    } else if (tx.height === OFF_MAIN_CHAIN) {
      core.call("txStatus", { txid: r.txid, status: "notInMainChain" });
    } else {
      core.call("storeTx", { height: Number(tx.height) }, tx.data);
      stored++;
    }
  }
  return stored;
}

/** The light server, reached through OHTTP. */
export class Lwd {
  constructor(
    private readonly base: string,
    private readonly send: PrivateFetch,
  ) {}

  async tip(): Promise<number> {
    const [msg] = await lwdCall(this.send, this.base, "GetLatestBlock", new Uint8Array());
    if (!msg) throw new Error("GetLatestBlock returned nothing");
    return blockIdHeight(msg);
  }

  async treeState(height: number): Promise<Uint8Array> {
    const [msg] = await lwdCall(this.send, this.base, "GetTreeState", new Uint8Array(blockId(height)));
    if (!msg) throw new Error(`no tree state for ${height}`);
    return msg;
  }

  subtreeRoots(protocol: number): Promise<Uint8Array[]> {
    return lwdCall(this.send, this.base, "GetSubtreeRoots", subtreeRootsArg(0, protocol));
  }

  /** Compact blocks in [start, end). */
  blocks(start: number, end: number): Promise<Uint8Array[]> {
    return lwdCall(this.send, this.base, "GetBlockRange", blockRange(start, end - 1));
  }

  /** A full transaction and its height, or null when the light server does not know it. */
  async transaction(txid: string): Promise<{ data: Uint8Array; height: bigint } | null> {
    try {
      const [msg] = await lwdCall(this.send, this.base, "GetTransaction", txFilter(txid));
      return msg ? rawTransactionReply(msg) : null;
    } catch (e) {
      if (e instanceof Error && NOT_FOUND.test(e.message)) return null;
      throw e;
    }
  }

  /** One transparent address's unspent outputs since `startHeight`, as `GetAddressUtxosReplyList` bytes. */
  async utxos(address: string, startHeight: number): Promise<Uint8Array> {
    const [msg] = await lwdCall(this.send, this.base, "GetAddressUtxos", addressUtxosArg(address, startHeight));
    return msg ?? new Uint8Array();
  }

  async broadcast(raw: Uint8Array): Promise<void> {
    const [msg] = await lwdCall(this.send, this.base, "SendTransaction", rawTransaction(raw));
    const reply = msg ? sendResponse(msg) : { code: -1, message: "no reply" };
    if (reply.code !== 0) throw new Error(`broadcast rejected: ${reply.message}`);
  }
}

/**
 * Creates the account. A new wallet's birthday is just below the tip; a restored wallet passes the
 * height to start scanning from.
 */
export async function createAccount(core: CoreModule, lwd: Lwd, seedHex: string, birthday?: number): Promise<number> {
  const start = birthday ?? (await lwd.tip()) - BIRTHDAY_LOOKBACK_BLOCKS;
  const prior = await lwd.treeState(start - 1);
  return core.call<{ birthday: number }>("createAccount", { seed: seedHex }, prior).birthday;
}

/**
 * Brings the wallet to the chain tip: tip → subtree roots → scan the suggested ranges in
 * batches. Calls `persist` after every batch so a closed tab loses at most one batch. A chain
 * reorg makes the core rewind a few blocks; the loop then simply asks for fresh ranges.
 */
export async function syncToTip(
  core: CoreModule,
  lwd: Lwd,
  onProgress: (p: SyncProgress) => void,
  persist: () => void,
): Promise<void> {
  for (const { name, id } of SUBTREE_PROTOCOLS) {
    const roots = await lwd.subtreeRoots(id);
    core.call("putSubtreeRoots", { protocol: name, startIndex: 0 }, framed(roots));
  }
  persist();
  let received = 0;
  // A rewind invalidates the wallet's view of the tip (it now ends at the rewind height), so each
  // round starts by telling the core where the chain is, as zcash_client_backend's own sync does.
  for (let rewinds = 0; ; rewinds++) {
    const tip = await lwd.tip();
    core.call("updateTip", { height: tip });
    const reorg = await scanRanges(core, lwd, (scannedTo, remainingBlocks, got) => {
      received += got;
      persist();
      onProgress({ tip, scannedTo, remainingBlocks, received });
    });
    if (!reorg) return;
    persist();
    if (rewinds >= MAX_REORG_REWINDS) throw new Error(`the chain keeps reorganising near block ${reorg.at}`);
  }
}

/** Scans the suggested ranges in batches until none are left, or until a reorg forces a rewind. */
async function scanRanges(
  core: CoreModule,
  lwd: Lwd,
  onBatch: (scannedTo: number, remainingBlocks: number, received: number) => void,
): Promise<{ at: number; rewoundTo: number } | null> {
  for (;;) {
    const todo = core.call<ScanRange[]>("scanRanges").filter((r) => !DONE.has(r.priority));
    const first = todo[0];
    if (!first) return null;
    const remaining = todo.reduce((n, r) => n + (r.end - r.start), 0);
    const end = Math.min(first.start + SCAN_BATCH_BLOCKS, first.end);
    const [prior, blocks] = await Promise.all([lwd.treeState(first.start - 1), lwd.blocks(first.start, end)]);
    const res = core.call<ScanResult>("scanBlocks", { fromHeight: first.start }, framed([prior, ...blocks]));
    if ("reorg" in res) return res.reorg;
    onBatch(end, Math.max(0, remaining - (end - first.start)), res.received);
  }
}
