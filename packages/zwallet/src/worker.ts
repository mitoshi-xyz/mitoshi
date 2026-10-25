/// <reference lib="webworker" />
/**
 * The wallet worker: owns the WASI wallet core so proving and scanning never block the page.
 * Every reply carries the request id; `progress` and `persist` are unsolicited events.
 */
import { createPrivateFetch } from "@mitoshi/net";
import { LOAD_REPORT_BYTES, LWD_UPSTREAM } from "./constants";
import { CoreModule } from "./core";
import { createAccount, enhance, Lwd, syncToTip } from "./sync";
import type { Built, HistoryEntry, Note, Proposal, Request, Response, Shielded, Summary, UtxoCheck } from "./types";

declare const self: DedicatedWorkerGlobalScope;

let core: CoreModule | null = null;
let lwd: Lwd | null = null;
let syncing: Promise<void> | null = null;

const post = (msg: Response, transfer: Transferable[] = []) => self.postMessage(msg, transfer);

function persist() {
  if (!core) return;
  const bytes = core.fileBytes();
  post({ event: "persist", bytes }, [bytes.buffer]);
}

function ready(): { core: CoreModule; lwd: Lwd } {
  if (!core || !lwd) throw new Error("wallet is not open");
  return { core, lwd };
}

/**
 * Fetches and compiles the wallet core, compiling while it streams in and reporting bytes as they
 * arrive. A compressed response has no usable length (it counts compressed bytes), so total is null.
 */
async function loadEngine(url: string): Promise<WebAssembly.Module> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`the wallet engine did not download (HTTP ${res.status})`);
  const length = Number(res.headers.get("content-length"));
  const total = res.headers.get("content-encoding") || !length ? null : length;
  let loaded = 0;
  let reported = 0;
  const counted = res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, out) {
        loaded += chunk.byteLength;
        if (loaded - reported >= LOAD_REPORT_BYTES) {
          reported = loaded;
          post({ event: "load", load: { loaded, total } });
        }
        out.enqueue(chunk);
      },
      flush() {
        post({ event: "load", load: { loaded, total: loaded } });
      },
    }),
  );
  return WebAssembly.compileStreaming(new Response(counted, { headers: { "content-type": "application/wasm" } }));
}

const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (b) => Number.parseInt(b, 16));

async function handle(req: Request): Promise<unknown> {
  switch (req.kind) {
    case "open": {
      const wasm = await loadEngine(req.wasmUrl);
      core = await CoreModule.load(wasm, req.saved);
      lwd = new Lwd(LWD_UPSTREAM[req.network], createPrivateFetch(req.relay));
      return core.call("init", { network: req.network });
    }
    case "create": {
      const w = ready();
      const birthday = await createAccount(w.core, w.lwd, req.seedHex, req.birthday);
      persist();
      return { birthday };
    }
    case "sync": {
      const w = ready();
      // One sync at a time; a second request joins the running one.
      syncing ??= syncToTip(w.core, w.lwd, (progress) => post({ event: "progress", progress }), persist)
        .then(async () => {
          if ((await enhance(w.core, w.lwd)) > 0) persist();
        })
        .finally(() => {
          syncing = null;
        });
      await syncing;
      return w.core.call<Summary>("summary");
    }
    case "summary":
      return ready().core.call<Summary>("summary");
    case "freshAddress": {
      const reply = ready().core.call<{ address: string }>("freshAddress");
      persist();
      return reply;
    }
    case "transparentAddress": {
      const reply = ready().core.call<{ address: string }>("transparentAddress");
      persist();
      return reply;
    }
    case "transparentAddresses":
      return ready().core.call<{ addresses: string[] }>("transparentAddresses");
    case "checkUtxos": {
      const w = ready();
      const { birthday } = w.core.call<Summary>("summary");
      const reply = await w.lwd.utxos(req.address, birthday ?? 0);
      const found = w.core.call<UtxoCheck>("putUtxos", {}, reply);
      if (found.stored > 0) persist();
      return found;
    }
    case "shield": {
      const w = ready();
      const built = w.core.call<Shielded & { raw?: string }>("shield", { seed: req.seedHex });
      if (!built.txid || !built.raw) return { txid: null };
      persist();
      await w.lwd.broadcast(hexToBytes(built.raw));
      return { txid: built.txid, fee: built.fee, zat: built.zat };
    }
    case "notes":
      return ready().core.call<Note[]>("notes");
    case "lockNotes": {
      const n = ready().core.call<number>("lockNotes", { notes: req.notes, untilHeight: req.untilHeight });
      persist();
      return n;
    }
    case "unlockNotes": {
      const n = ready().core.call<number>("unlockNotes", { notes: req.notes });
      persist();
      return n;
    }
    case "history":
      return ready().core.call<HistoryEntry[]>("history", { limit: req.limit });
    case "warmProver":
      return ready().core.call<{ ms: number }>("warmProver");
    case "propose":
      return ready().core.call<Proposal>("propose", { kind: req.send, to: req.to, zat: req.zat });
    case "send": {
      const w = ready();
      const proposal = w.core.call<Proposal>("propose", { kind: req.send, to: req.to, zat: req.zat });
      const built = w.core.call<Built>("build", { id: proposal.id, seed: req.seedHex });
      persist();
      await w.lwd.broadcast(hexToBytes(built.raw));
      return { txid: built.txid, fee: proposal.fee };
    }
  }
}

self.onmessage = (e: MessageEvent<Request>) => {
  const req = e.data;
  handle(req).then(
    (ok) => post({ id: req.id, ok }),
    (err: unknown) => post({ id: req.id, error: err instanceof Error ? err.message : String(err) }),
  );
};
