import type { Registry } from "@mitoshi/engine";
import { DESK_FILES, VAULT_IV_BYTES, ZEC_NETWORK } from "@/constants";

/**
 * A sealed desk: the vault records of one wallet made ahead of judging (its words, its synced wallet file and its
 * registry, with a Hyperliquid wallet ready to trade), encrypted under a key derived from the judges' link. Opening
 * one writes those records into this origin's vault, so the desk opens synced, as if it had always been here.
 *
 * The link's key is 32 random bytes; HKDF gives the index and each desk a key of its own. Files are
 * `iv (12 bytes) || AES-GCM ciphertext`, served as plain static files: without the link they are noise.
 */

const KEY_BYTES = 32;
/** Base64 comes in groups of four characters; a link's key leaves the padding off. */
const B64_GROUP = 4;
const HTTP_NOT_FOUND = 404;
const VERSION = 1;
const INDEX_INFO = "mitoshi desk index";
const deskInfo = (n: number) => `mitoshi desk ${n}`;

export interface DeskIndex {
  v: number;
  network: string;
  /** Each desk's ready Hyperliquid wallet, so a free desk can be found from public data without opening any. */
  desks: { n: number; hyperliquid: string }[];
}

export interface DeskBundle {
  v: number;
  n: number;
  network: string;
  mnemonic: string;
  /** The wallet file (zcash_client_sqlite), base64. */
  walletdb: string;
  registry: Registry;
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

function fromB64url(text: string): Uint8Array {
  const b64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const pad = (B64_GROUP - (b64.length % B64_GROUP)) % B64_GROUP;
  return Uint8Array.from(atob(b64 + "=".repeat(pad)), (c) => c.charCodeAt(0));
}

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) out += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(out);
}

export const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export function newDeskKey(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

/** The key from a judges' link (`…#k=KEY`), or from the key pasted alone; null if it is not one. */
export function parseDeskKey(text: string): string | null {
  const found = /(?:#|^|[?&])k=([A-Za-z0-9_-]{43})\b/.exec(text.trim()) ?? /^([A-Za-z0-9_-]{43})$/.exec(text.trim());
  return found?.[1] ?? null;
}

async function derive(key: string, info: string): Promise<CryptoKey> {
  const raw = fromB64url(key);
  if (raw.length !== KEY_BYTES) throw new Error("not a desk key");
  const base = await crypto.subtle.importKey("raw", new Uint8Array(raw), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(), info: new TextEncoder().encode(info) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(key: CryptoKey, value: unknown): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(VAULT_IV_BYTES));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return out;
}

async function unseal<T>(key: CryptoKey, bytes: Uint8Array): Promise<T> {
  const iv = new Uint8Array(bytes.subarray(0, VAULT_IV_BYTES));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    new Uint8Array(bytes.subarray(VAULT_IV_BYTES)),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function sealIndex(key: string, index: DeskIndex): Promise<Uint8Array> {
  return seal(await derive(key, INDEX_INFO), index);
}

export async function sealDesk(key: string, bundle: DeskBundle): Promise<Uint8Array> {
  return seal(await derive(key, deskInfo(bundle.n)), bundle);
}

async function fetchBytes(path: string): Promise<Uint8Array> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok)
    throw new Error(res.status === HTTP_NOT_FOUND ? "The desks are not published yet" : `Could not load ${path}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** The desk list, opened with the link's key. A wrong key fails here, before anything else is read. */
export async function openIndex(key: string): Promise<DeskIndex> {
  const bytes = await fetchBytes(`${DESK_FILES}/index.bin`);
  try {
    const index = await unseal<DeskIndex>(await derive(key, INDEX_INFO), bytes);
    if (index.v !== VERSION || index.network !== ZEC_NETWORK) throw new Error("desks for another network");
    return index;
  } catch {
    throw new Error("This key doesn't open the desks");
  }
}

export async function openDesk(key: string, n: number): Promise<DeskBundle> {
  const bundle = await unseal<DeskBundle>(await derive(key, deskInfo(n)), await fetchBytes(`${DESK_FILES}/${n}.bin`));
  if (bundle.v !== VERSION || bundle.n !== n) throw new Error(`Desk ${n} is not a desk file`);
  return bundle;
}

export const DESK_VERSION = VERSION;
