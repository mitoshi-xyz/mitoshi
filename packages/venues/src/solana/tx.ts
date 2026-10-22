import { ed25519 } from "@noble/curves/ed25519.js";
import { base58, base64 } from "@scure/base";

/**
 * The few Solana wire-format pieces Mitoshi needs: signing a transaction someone else built
 * (Jupiter Ultra) and building one System Program transfer (the trip home).
 */

const SIGNATURE_BYTES = 64;
const PUBKEY_BYTES = 32;
const VERSION_FLAG = 0x80;
const SEVEN_BITS = 0x7f;
const CONTINUE = 0x80;
const SYSTEM_PROGRAM = new Uint8Array(PUBKEY_BYTES);
const TRANSFER_INSTRUCTION = 2;
const U32_BYTES = 4;
const U64_BYTES = 8;
/** Bits of payload per compact-u16 byte. */
const COMPACT_SHIFT = 7;
/** The message header is three bytes (signers, read-only signed, read-only unsigned). */
const HEADER_BYTES = 3;
/** Accounts in a transfer: from, to, the system program. */
const TRANSFER_KEYS = 3;

function readCompactU16(buf: Uint8Array, at: number): [number, number] {
  let value = 0;
  let shift = 0;
  let i = at;
  for (;;) {
    const byte = buf[i++] ?? 0;
    value |= (byte & SEVEN_BITS) << shift;
    if ((byte & CONTINUE) === 0) return [value, i];
    shift += COMPACT_SHIFT;
  }
}

function compactU16(n: number): number[] {
  const out: number[] = [];
  let v = n;
  do {
    let byte = v & SEVEN_BITS;
    v >>= COMPACT_SHIFT;
    if (v) byte |= CONTINUE;
    out.push(byte);
  } while (v);
  return out;
}

/**
 * Signs a serialized transaction (legacy or v0) in place for `publicKey`, which must be one of
 * its required signers. Returns the signed transaction, base64.
 */
export function signTransaction(txBase64: string, secret: Uint8Array, publicKey: Uint8Array): string {
  const tx = base64.decode(txBase64);
  const [sigCount, sigStart] = readCompactU16(tx, 0);
  const messageStart = sigStart + sigCount * SIGNATURE_BYTES;
  const message = tx.subarray(messageStart);
  // Message: [version prefix if v0] [header: 3 bytes] [compact keys count] [keys...]
  let at = (message[0] ?? 0) & VERSION_FLAG ? 1 : 0;
  const requiredSigners = message[at] ?? 0;
  at += HEADER_BYTES;
  const [keyCount, keysStart] = readCompactU16(message, at);
  let index = -1;
  for (let k = 0; k < Math.min(keyCount, requiredSigners); k++) {
    const key = message.subarray(keysStart + k * PUBKEY_BYTES, keysStart + (k + 1) * PUBKEY_BYTES);
    if (key.every((b, j) => b === publicKey[j])) index = k;
  }
  if (index < 0 || index >= sigCount) throw new Error("this wallet is not a signer of the transaction");
  const signature = ed25519.sign(message, secret);
  const out = tx.slice();
  out.set(signature, sigStart + index * SIGNATURE_BYTES);
  return base64.encode(out);
}

/** A signed legacy transaction moving `lamports` from `from` to `to` (base64). */
export function transferTransaction(
  secret: Uint8Array,
  from: Uint8Array,
  to: string,
  lamports: bigint,
  recentBlockhash: string,
): string {
  const toKey = base58.decode(to);
  if (toKey.length !== PUBKEY_BYTES) throw new Error("not a Solana address");
  const data = new Uint8Array(U32_BYTES + U64_BYTES);
  const view = new DataView(data.buffer);
  view.setUint32(0, TRANSFER_INSTRUCTION, true);
  view.setBigUint64(U32_BYTES, lamports, true);
  const message = new Uint8Array([
    // Header: 1 required signature, 0 read-only signed, 1 read-only unsigned (the system program).
    1,
    0,
    1,
    ...compactU16(TRANSFER_KEYS),
    ...from,
    ...toKey,
    ...SYSTEM_PROGRAM,
    ...base58.decode(recentBlockhash),
    ...compactU16(1),
    2,
    ...compactU16(2),
    0,
    1,
    ...compactU16(data.length),
    ...data,
  ]);
  const signature = ed25519.sign(message, secret);
  return base64.encode(new Uint8Array([...compactU16(1), ...signature, ...message]));
}
