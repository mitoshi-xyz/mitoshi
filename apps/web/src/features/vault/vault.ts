import { LOCK_PBKDF2_ITERATIONS, LOCK_SALT_BYTES, VAULT_DB, VAULT_IV_BYTES, VAULT_KEY_BITS } from "@/constants";

/**
 * The device vault: one IndexedDB database where every record is AES-GCM encrypted under a
 * non-extractable WebCrypto key that never leaves the browser. Nothing in it is ever sent anywhere.
 *
 * With the passphrase lock on, that key is stored only wrapped (AES-KW) under a key derived from
 * the passphrase (PBKDF2-SHA-256), and lives unwrapped in memory for this tab only.
 */

/**
 * `pending` marks a wallet whose words are saved but whose account is not made yet ("new" or
 * "restore"; empty once made), so a tab closed mid-way finishes the job on its next open.
 */
type RecordName = "mnemonic" | "walletdb" | "registry" | "pending";

interface StoredRecord {
  id: string;
  iv: Uint8Array;
  data: ArrayBuffer;
}

const KEY_ID = "vault-key";
const LOCK_ID = "vault-key-locked";

interface LockedKey {
  wrapped: ArrayBuffer;
  salt: Uint8Array;
  iterations: number;
}

/** The vault is locked: {@link unlockVault} with the passphrase first. */
export class VaultLockedError extends Error {
  constructor() {
    super("the vault is locked");
  }
}

/** The unwrapped key while the vault is unlocked (this tab only). */
let sessionKey: CryptoKey | null = null;

/**
 * Every write goes through this queue, one at a time, so a save can never land between the
 * re-encryption and the key swap of {@link setVaultLock} (it would be stored under a dead key).
 */
let writes: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const next = writes.then(job, job);
  writes = next.catch(() => undefined);
  return next;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB.name, VAULT_DB.version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VAULT_DB.keys)) db.createObjectStore(VAULT_DB.keys);
      if (!db.objectStoreNames.contains(VAULT_DB.records)) db.createObjectStore(VAULT_DB.records, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = op(tx.objectStore(store));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

async function vaultKey(): Promise<CryptoKey> {
  if (sessionKey) return sessionKey;
  const locked = await run<LockedKey | undefined>(VAULT_DB.keys, "readonly", (s) => s.get(LOCK_ID));
  if (locked) throw new VaultLockedError();
  const existing = await run<CryptoKey | undefined>(VAULT_DB.keys, "readonly", (s) => s.get(KEY_ID));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: VAULT_KEY_BITS }, false, [
    "encrypt",
    "decrypt",
  ]);
  await run(VAULT_DB.keys, "readwrite", (s) => s.put(key, KEY_ID));
  return key;
}

function passphraseKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  return crypto.subtle
    .importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"])
    .then((base) =>
      crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: new Uint8Array(salt), iterations, hash: "SHA-256" },
        base,
        { name: "AES-KW", length: VAULT_KEY_BITS },
        false,
        ["wrapKey", "unwrapKey"],
      ),
    );
}

/** Whether a passphrase guards this vault, and whether it is unlocked in this tab. */
export async function vaultLockState(): Promise<{ lockOn: boolean; unlocked: boolean }> {
  const locked = await run<LockedKey | undefined>(VAULT_DB.keys, "readonly", (s) => s.get(LOCK_ID));
  return { lockOn: Boolean(locked), unlocked: !locked || sessionKey !== null };
}

/** Unlocks the vault for this tab. Throws on a wrong passphrase. */
export async function unlockVault(passphrase: string): Promise<void> {
  const locked = await run<LockedKey | undefined>(VAULT_DB.keys, "readonly", (s) => s.get(LOCK_ID));
  if (!locked) return;
  const kek = await passphraseKey(passphrase, locked.salt, locked.iterations);
  try {
    sessionKey = await crypto.subtle.unwrapKey("raw", locked.wrapped, kek, "AES-KW", { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  } catch {
    throw new Error("That passphrase doesn't open this vault");
  }
}

/** Forgets the unlocked key: the next read needs the passphrase again. */
export function lockVault() {
  sessionKey = null;
}

/**
 * Turns the passphrase lock on (with `passphrase`) or off (null). Every record is re-encrypted
 * under a brand-new key, and the records and keys are swapped in one transaction, so the vault
 * is never left half under one key and half under another.
 */
export function setVaultLock(passphrase: string | null): Promise<void> {
  return serial(() => relock(passphrase));
}

async function relock(passphrase: string | null): Promise<void> {
  const current = await vaultKey();
  const stored = await run<StoredRecord[]>(VAULT_DB.records, "readonly", (s) => s.getAll());
  const plain = await Promise.all(
    stored.map(async (r) => ({
      id: r.id,
      bytes: await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(r.iv) }, current, r.data),
    })),
  );
  let next: CryptoKey;
  let lock: LockedKey | null = null;
  if (passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(LOCK_SALT_BYTES));
    const kek = await passphraseKey(passphrase, salt, LOCK_PBKDF2_ITERATIONS);
    // Extractable only for the moment it takes to wrap it; what is kept is the unwrapped, non-extractable copy.
    const fresh = await crypto.subtle.generateKey({ name: "AES-GCM", length: VAULT_KEY_BITS }, true, [
      "encrypt",
      "decrypt",
    ]);
    const wrapped = await crypto.subtle.wrapKey("raw", fresh, kek, "AES-KW");
    next = await crypto.subtle.unwrapKey("raw", wrapped, kek, "AES-KW", { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
    lock = { wrapped, salt, iterations: LOCK_PBKDF2_ITERATIONS };
  } else {
    next = await crypto.subtle.generateKey({ name: "AES-GCM", length: VAULT_KEY_BITS }, false, ["encrypt", "decrypt"]);
  }
  const records: StoredRecord[] = await Promise.all(
    plain.map(async ({ id, bytes }) => {
      const iv = crypto.getRandomValues(new Uint8Array(VAULT_IV_BYTES));
      return { id, iv, data: await crypto.subtle.encrypt({ name: "AES-GCM", iv }, next, bytes) };
    }),
  );
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([VAULT_DB.keys, VAULT_DB.records], "readwrite");
    const keys = tx.objectStore(VAULT_DB.keys);
    const recs = tx.objectStore(VAULT_DB.records);
    for (const r of records) recs.put(r);
    if (lock) {
      keys.put(lock, LOCK_ID);
      keys.delete(KEY_ID);
    } else {
      keys.put(next, KEY_ID);
      keys.delete(LOCK_ID);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
  sessionKey = lock ? next : null;
}

/** Encrypts and stores `bytes` under `name` (one record per name and network). */
export function vaultPut(network: string, name: RecordName, bytes: Uint8Array): Promise<void> {
  return serial(async () => {
    const key = await vaultKey();
    const iv = crypto.getRandomValues(new Uint8Array(VAULT_IV_BYTES));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(bytes));
    const record: StoredRecord = { id: `${network}:${name}`, iv, data };
    await run(VAULT_DB.records, "readwrite", (s) => s.put(record));
  });
}

/** Decrypts the record under `name`, or returns null when there is none. */
export async function vaultGet(network: string, name: RecordName): Promise<Uint8Array | null> {
  const record = await run<StoredRecord | undefined>(VAULT_DB.records, "readonly", (s) => s.get(`${network}:${name}`));
  if (!record) return null;
  const key = await vaultKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(record.iv) }, key, record.data);
  return new Uint8Array(plain);
}

/** Deletes the whole vault: keys, seed and wallet file. */
export function forgetVault(): Promise<void> {
  sessionKey = null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(VAULT_DB.name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
