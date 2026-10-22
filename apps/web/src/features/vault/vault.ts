import { VAULT_DB, VAULT_IV_BYTES, VAULT_KEY_BITS } from "@/constants";

/**
 * The device vault: one IndexedDB database where every record is AES-GCM encrypted under a
 * non-extractable WebCrypto key that never leaves the browser. Nothing in it is ever sent anywhere.
 */

type RecordName = "mnemonic" | "walletdb" | "registry";

interface StoredRecord {
  id: string;
  iv: Uint8Array;
  data: ArrayBuffer;
}

const KEY_ID = "vault-key";

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
  const existing = await run<CryptoKey | undefined>(VAULT_DB.keys, "readonly", (s) => s.get(KEY_ID));
  if (existing) return existing;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: VAULT_KEY_BITS }, false, [
    "encrypt",
    "decrypt",
  ]);
  await run(VAULT_DB.keys, "readwrite", (s) => s.put(key, KEY_ID));
  return key;
}

/** Encrypts and stores `bytes` under `name` (one record per name and network). */
export async function vaultPut(network: string, name: RecordName, bytes: Uint8Array): Promise<void> {
  const key = await vaultKey();
  const iv = crypto.getRandomValues(new Uint8Array(VAULT_IV_BYTES));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(bytes));
  const record: StoredRecord = { id: `${network}:${name}`, iv, data };
  await run(VAULT_DB.records, "readwrite", (s) => s.put(record));
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
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(VAULT_DB.name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
