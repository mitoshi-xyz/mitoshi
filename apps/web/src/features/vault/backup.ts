"use client";

import type { Registry } from "@mitoshi/engine";
import { LOCK_PBKDF2_ITERATIONS, LOCK_SALT_BYTES, VAULT_IV_BYTES, VAULT_KEY_BITS, ZEC_NETWORK } from "@/constants";
import { vaultGet } from "./vault";

/**
 * The backup file: the 24 words and the private-wallet list, encrypted under a passphrase
 * (PBKDF2-SHA-256 → AES-GCM), so the file alone is useless to whoever finds it. The list matters:
 * it says which wallets the words have made and where each one's money is.
 */
const FORMAT = "mitoshi-backup";
const VERSION = 1;

interface BackupFile {
  format: typeof FORMAT;
  version: typeof VERSION;
  network: string;
  createdAt: number;
  kdf: { name: "PBKDF2-SHA-256"; iterations: number; salt: string };
  iv: string;
  data: string;
}

export interface BackupContents {
  network: string;
  mnemonic: string;
  registry: Registry | null;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function fileKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: VAULT_KEY_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Makes the encrypted backup file of this browser's wallet. */
export async function makeBackup(passphrase: string): Promise<Blob> {
  const mnemonic = await vaultGet(ZEC_NETWORK, "mnemonic");
  if (!mnemonic) throw new Error("there is no wallet in this browser to back up");
  const registry = await vaultGet(ZEC_NETWORK, "registry");
  const plain = new TextEncoder().encode(
    JSON.stringify({
      mnemonic: new TextDecoder().decode(mnemonic),
      registry: registry ? JSON.parse(new TextDecoder().decode(registry)) : null,
    }),
  );
  const salt = crypto.getRandomValues(new Uint8Array(LOCK_SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(VAULT_IV_BYTES));
  const key = await fileKey(passphrase, salt, LOCK_PBKDF2_ITERATIONS);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    network: ZEC_NETWORK,
    createdAt: Date.now(),
    kdf: { name: "PBKDF2-SHA-256", iterations: LOCK_PBKDF2_ITERATIONS, salt: b64(salt) },
    iv: b64(iv),
    data: b64(data),
  };
  return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
}

/** Opens a backup file with its passphrase. Throws in words on a wrong file, network or passphrase. */
export async function openBackup(text: string, passphrase: string): Promise<BackupContents> {
  let file: BackupFile;
  try {
    file = JSON.parse(text) as BackupFile;
  } catch {
    throw new Error("That file is not a Mitoshi backup");
  }
  if (file.format !== FORMAT || file.version !== VERSION) throw new Error("That file is not a Mitoshi backup");
  if (file.network !== ZEC_NETWORK) {
    throw new Error(
      `That backup is for ${file.network === "main" ? "mainnet" : "testnet"}, and this is ${ZEC_NETWORK === "main" ? "mainnet" : "testnet"}`,
    );
  }
  const key = await fileKey(passphrase, unb64(file.kdf.salt), file.kdf.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(file.iv) }, key, unb64(file.data));
  } catch {
    throw new Error("That passphrase doesn't open this backup");
  }
  const body = JSON.parse(new TextDecoder().decode(plain)) as { mnemonic: string; registry: Registry | null };
  return { network: file.network, mnemonic: body.mnemonic, registry: body.registry };
}

/** Saves the backup file to the device ("mitoshi-backup-2026-10-22.json"). */
export function downloadBackup(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mitoshi-backup-${new Date().toISOString().slice(0, "yyyy-mm-dd".length)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
