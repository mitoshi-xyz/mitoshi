/// <reference lib="webworker" />
/**
 * The wallet worker: owns the WASI wallet core so proving and scanning never block the page.
 * Every reply carries the request id; `progress` and `persist` are unsolicited events.
 */
import { createPrivateFetch } from "@mitoshi/net";
import { LWD_UPSTREAM } from "./constants";
import { CoreModule } from "./core";
import { createAccount, Lwd, syncToTip } from "./sync";
import type { Built, Proposal, Request, Response, Summary } from "./types";

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

const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (b) => Number.parseInt(b, 16));

async function handle(req: Request): Promise<unknown> {
  switch (req.kind) {
    case "open": {
      const wasm = await WebAssembly.compileStreaming(fetch(req.wasmUrl));
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
      syncing ??= syncToTip(w.core, w.lwd, (progress) => post({ event: "progress", progress }), persist).finally(() => {
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
    case "warmProver":
      return ready().core.call<{ ms: number }>("warmProver");
    case "propose":
      return ready().core.call<Proposal>("propose", { to: req.to, zat: req.zat });
    case "send": {
      const w = ready();
      const proposal = w.core.call<Proposal>("propose", { to: req.to, zat: req.zat });
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
