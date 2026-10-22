import { ConsoleStdout, File, OpenFile, PreopenDirectory, WASI } from "@bjorn3/browser_wasi_shim";
import { WALLET_FILE, WASI_DATA_DIR } from "./constants";

interface CoreExports {
  memory: WebAssembly.Memory;
  zw_alloc(len: number): number;
  zw_free(ptr: number, len: number): void;
  zw_call(mp: number, ml: number, ap: number, al: number, bp: number, bl: number): number;
  zw_result_ptr(): number;
}

type Reply<T> = { ok: T } | { error: string };

/**
 * The Rust wallet core (Zcash's SQLite wallet store on WASI). Its database is one file in an
 * in-memory WASI directory: pass the saved bytes in, read them back with {@link CoreModule.fileBytes}
 * after any call that changes the wallet, and persist them (encrypted) outside.
 */
export class CoreModule {
  private constructor(
    private readonly ex: CoreExports,
    private readonly dir: PreopenDirectory,
  ) {}

  static async load(wasm: WebAssembly.Module | ArrayBuffer, saved?: Uint8Array): Promise<CoreModule> {
    const files = new Map<string, File>();
    if (saved?.length) files.set(WALLET_FILE, new File(saved));
    const dir = new PreopenDirectory(WASI_DATA_DIR, files);
    const quiet = ConsoleStdout.lineBuffered(() => {});
    // `debug: false` must be explicit: the shim turns its syscall log on when the option is absent.
    const wasi = new WASI([], [], [new OpenFile(new File([])), quiet, quiet, dir], { debug: false });
    const module = wasm instanceof WebAssembly.Module ? wasm : await WebAssembly.compile(wasm);
    const instance = await WebAssembly.instantiate(module, { wasi_snapshot_preview1: wasi.wasiImport });
    const exports = instance.exports as unknown as CoreExports;
    // The shim's random_get falls back to Math.random() when memory is shared. Keys come from that
    // randomness, so a shared-memory build must never run.
    if (typeof SharedArrayBuffer !== "undefined" && exports.memory.buffer instanceof SharedArrayBuffer) {
      throw new Error("refusing to run the wallet core on shared memory (its randomness would be weak)");
    }
    wasi.initialize(instance as unknown as { exports: { memory: WebAssembly.Memory; _initialize?: () => unknown } });
    return new CoreModule(exports, dir);
  }

  private put(bytes: Uint8Array): [number, number] {
    if (!bytes.length) return [0, 0];
    const ptr = this.ex.zw_alloc(bytes.length);
    new Uint8Array(this.ex.memory.buffer, ptr, bytes.length).set(bytes);
    return [ptr, bytes.length];
  }

  /** Calls one core method. Throws with the core's message on failure. */
  call<T>(method: string, args: object = {}, bin: Uint8Array = new Uint8Array()): T {
    const enc = new TextEncoder();
    const buffers = [this.put(enc.encode(method)), this.put(enc.encode(JSON.stringify(args))), this.put(bin)] as const;
    const [[mp, ml], [ap, al], [bp, bl]] = buffers;
    const len = this.ex.zw_call(mp, ml, ap, al, bp, bl);
    for (const [ptr, size] of buffers) if (size) this.ex.zw_free(ptr, size);
    const text = new TextDecoder().decode(new Uint8Array(this.ex.memory.buffer, this.ex.zw_result_ptr(), len));
    const reply = JSON.parse(text) as Reply<T>;
    if ("error" in reply) throw new Error(`${method}: ${reply.error}`);
    return reply.ok;
  }

  /** A copy of the wallet database file, for encrypted persistence. */
  fileBytes(): Uint8Array {
    const entry = this.dir.dir.contents.get(WALLET_FILE);
    return entry instanceof File ? entry.data.slice() : new Uint8Array();
  }
}
