import { BIRTHDAY_LOOKBACK_BLOCKS, SCAN_BATCH_BLOCKS, SUBTREE_PROTOCOLS } from "./constants";
import type { CoreModule } from "./core";
import { lwdCall } from "./grpc-web";
import { blockId, blockIdHeight, blockRange, framed, rawTransaction, sendResponse, subtreeRootsArg } from "./proto";
import type { ScanRange, SyncProgress } from "./types";

const DONE = new Set(["Scanned", "Ignored"]);

export class Lwd {
  constructor(private readonly base: string) {}

  async tip(): Promise<number> {
    const [msg] = await lwdCall(this.base, "GetLatestBlock", new Uint8Array());
    if (!msg) throw new Error("GetLatestBlock returned nothing");
    return blockIdHeight(msg);
  }

  async treeState(height: number): Promise<Uint8Array> {
    const [msg] = await lwdCall(this.base, "GetTreeState", new Uint8Array(blockId(height)));
    if (!msg) throw new Error(`no tree state for ${height}`);
    return msg;
  }

  subtreeRoots(protocol: number): Promise<Uint8Array[]> {
    return lwdCall(this.base, "GetSubtreeRoots", subtreeRootsArg(0, protocol));
  }

  /** Compact blocks in [start, end). */
  blocks(start: number, end: number): Promise<Uint8Array[]> {
    return lwdCall(this.base, "GetBlockRange", blockRange(start, end - 1));
  }

  async broadcast(raw: Uint8Array): Promise<void> {
    const [msg] = await lwdCall(this.base, "SendTransaction", rawTransaction(raw));
    const reply = msg ? sendResponse(msg) : { code: -1, message: "no reply" };
    if (reply.code !== 0) throw new Error(`broadcast rejected: ${reply.message}`);
  }
}

/** Creates the account with a birthday just below the tip. */
export async function createAccount(core: CoreModule, lwd: Lwd, seedHex: string): Promise<number> {
  const tip = await lwd.tip();
  const prior = await lwd.treeState(tip - BIRTHDAY_LOOKBACK_BLOCKS - 1);
  const { birthday } = core.call<{ birthday: number }>("createAccount", { seed: seedHex }, prior);
  return birthday;
}

/**
 * Brings the wallet to the chain tip: tip → subtree roots → scan the suggested ranges in
 * batches. Calls `persist` after every batch so a closed tab loses at most one batch.
 */
export async function syncToTip(
  core: CoreModule,
  lwd: Lwd,
  onProgress: (p: SyncProgress) => void,
  persist: () => void,
): Promise<void> {
  const tip = await lwd.tip();
  core.call("updateTip", { height: tip });
  for (const { name, id } of SUBTREE_PROTOCOLS) {
    const roots = await lwd.subtreeRoots(id);
    core.call("putSubtreeRoots", { protocol: name, startIndex: 0 }, framed(roots));
  }
  persist();
  let received = 0;
  for (;;) {
    const todo = core.call<ScanRange[]>("scanRanges").filter((r) => !DONE.has(r.priority));
    const first = todo[0];
    if (!first) break;
    const remaining = todo.reduce((n, r) => n + (r.end - r.start), 0);
    const end = Math.min(first.start + SCAN_BATCH_BLOCKS, first.end);
    const [prior, blocks] = await Promise.all([lwd.treeState(first.start - 1), lwd.blocks(first.start, end)]);
    const res = core.call<{ received: number }>("scanBlocks", { fromHeight: first.start }, framed([prior, ...blocks]));
    received += res.received;
    persist();
    onProgress({ tip, scannedTo: end, remainingBlocks: Math.max(0, remaining - (end - first.start)), received });
  }
}
