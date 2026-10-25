import type {
  EngineLoad,
  HistoryEntry,
  Network,
  Note,
  NoteRef,
  Proposal,
  Request,
  Response,
  Shielded,
  Summary,
  SyncProgress,
  UtxoCheck,
} from "./types";

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
type Call = DistributiveOmit<Request, "id">;

export interface WalletEvents {
  onProgress?: (p: SyncProgress) => void;
  /** The engine download, while it runs. */
  onLoad?: (l: EngineLoad) => void;
  /** The wallet file changed: encrypt and store these bytes. */
  onPersist?: (bytes: Uint8Array) => void;
}

/**
 * The page-side handle to the wallet worker. One instance per tab; every method resolves when the
 * worker replies.
 */
export class WalletClient {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  /** Set once the worker has replied at all; an error before that means it never started. */
  private started = false;
  private dead: Error | null = null;

  constructor(private readonly events: WalletEvents = {}) {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: "mitoshi-wallet" });
    this.worker.onmessage = (e: MessageEvent<Response>) => this.receive(e.data);
    // Without these a worker that fails to load (or throws outside a request) leaves every caller waiting forever.
    this.worker.onerror = (e) => {
      e.preventDefault();
      this.fail(
        new Error(`the wallet engine ${this.started ? "crashed" : "could not start"}: ${e.message || "no details"}`),
      );
    };
    this.worker.onmessageerror = () => this.fail(new Error("the wallet engine sent a reply that could not be read"));
  }

  private fail(err: Error) {
    if (!this.started) this.dead = err;
    for (const w of this.pending.values()) w.reject(err);
    this.pending.clear();
  }

  private receive(msg: Response) {
    this.started = true;
    if ("event" in msg) {
      if (msg.event === "progress") this.events.onProgress?.(msg.progress);
      else if (msg.event === "load") this.events.onLoad?.(msg.load);
      else this.events.onPersist?.(msg.bytes);
      return;
    }
    const waiter = this.pending.get(msg.id);
    if (!waiter) return;
    this.pending.delete(msg.id);
    if ("error" in msg) waiter.reject(new Error(msg.error));
    else waiter.resolve(msg.ok);
  }

  private request<T>(call: Call): Promise<T> {
    if (this.dead) return Promise.reject(this.dead);
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...call, id } as Request);
    });
  }

  /** Opens the wallet engine. `relay` is the OHTTP relay base every light-server call goes through. */
  open(network: Network, relay: string, saved?: Uint8Array): Promise<{ nu7Height: number | null }> {
    const wasmUrl = new URL("../generated/zwallet.wasm", import.meta.url).toString();
    return this.request(
      saved ? { kind: "open", network, relay, wasmUrl, saved } : { kind: "open", network, relay, wasmUrl },
    );
  }

  create(seedHex: string, birthday?: number): Promise<{ birthday: number }> {
    return this.request(birthday === undefined ? { kind: "create", seedHex } : { kind: "create", seedHex, birthday });
  }

  sync(): Promise<Summary> {
    return this.request({ kind: "sync" });
  }

  summary(): Promise<Summary> {
    return this.request({ kind: "summary" });
  }

  freshAddress(): Promise<{ address: string }> {
    return this.request({ kind: "freshAddress" });
  }

  /** A never-used transparent address, for a deposit from an exchange (exchanges pay only these). */
  transparentAddress(): Promise<{ address: string }> {
    return this.request({ kind: "transparentAddress" });
  }

  transparentAddresses(): Promise<{ addresses: string[] }> {
    return this.request({ kind: "transparentAddresses" });
  }

  /** Asks the light server (over OHTTP) what one transparent address holds, and records it. */
  checkUtxos(address: string): Promise<UtxoCheck> {
    return this.request({ kind: "checkUtxos", address });
  }

  /** Moves what transparent addresses hold into Ironwood, and broadcasts it (or `txid: null` if too little). */
  shield(seedHex: string): Promise<Shielded> {
    return this.request({ kind: "shield", seedHex });
  }

  /** Every unspent note with its origin. */
  notes(): Promise<Note[]> {
    return this.request({ kind: "notes" });
  }

  /** Rests notes: they cannot be spent (and count as locked) until the chain passes `untilHeight`. */
  lockNotes(notes: NoteRef[], untilHeight: number): Promise<number> {
    return this.request({ kind: "lockNotes", notes, untilHeight });
  }

  unlockNotes(notes: NoteRef[]): Promise<number> {
    return this.request({ kind: "unlockNotes", notes });
  }

  history(limit = 100): Promise<HistoryEntry[]> {
    return this.request({ kind: "history", limit });
  }

  warmProver(): Promise<{ ms: number }> {
    return this.request({ kind: "warmProver" });
  }

  /** Plans a payment (Ironwood notes only) without sending it: its fee, and whether the recipient is public. */
  propose(to: string, zat: number): Promise<Proposal> {
    return this.request({ kind: "propose", send: "pay", to, zat });
  }

  /** Proves, signs and broadcasts a payment from Ironwood notes. */
  send(to: string, zat: number, seedHex: string): Promise<{ txid: string; fee: number }> {
    return this.request({ kind: "send", send: "pay", to, zat, seedHex });
  }

  /** Moves one standard amount of Orchard value into Ironwood (a ZIP 318 canonical crossing), or refuses. */
  migrate(zat: number, seedHex: string): Promise<{ txid: string; fee: number }> {
    return this.request({ kind: "send", send: "migrate", to: "", zat, seedHex });
  }

  close() {
    this.worker.terminate();
    for (const { reject } of this.pending.values()) reject(new Error("wallet closed"));
    this.pending.clear();
  }
}
