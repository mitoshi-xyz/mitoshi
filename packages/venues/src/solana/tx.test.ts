import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ed25519 } from "@noble/curves/ed25519.js";
import { base58, base64 } from "@scure/base";
import { signTransaction, transferTransaction } from "./tx.ts";

const secret = new Uint8Array(32).fill(3);
const publicKey = ed25519.getPublicKey(secret);
const other = base58.encode(ed25519.getPublicKey(new Uint8Array(32).fill(4)));
const blockhash = base58.encode(new Uint8Array(32).fill(9));

describe("solana transactions", () => {
  it("builds a signed System Program transfer", () => {
    const tx = base64.decode(transferTransaction(secret, publicKey, other, 123_456_789n, blockhash));
    assert.equal(tx[0], 1, "one signature");
    const signature = tx.subarray(1, 65);
    const message = tx.subarray(65);
    assert.ok(ed25519.verify(signature, message, publicKey));
    assert.deepEqual([...message.subarray(0, 4)], [1, 0, 1, 3], "header and three keys");
    const data = message.subarray(message.length - 12);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    assert.equal(view.getUint32(0, true), 2, "transfer instruction");
    assert.equal(view.getBigUint64(4, true), 123_456_789n);
  });

  it("signs its own slot in a two-signer v0 transaction", () => {
    const maker = ed25519.getPublicKey(new Uint8Array(32).fill(5));
    // v0 message: prefix, header (2 signers), 2 keys (maker first, us second), blockhash, no instructions, no lookups.
    const message = new Uint8Array([0x80, 2, 0, 0, 2, ...maker, ...publicKey, ...new Uint8Array(32), 0, 0]);
    const unsigned = new Uint8Array([2, ...new Uint8Array(128), ...message]);
    const signed = base64.decode(signTransaction(base64.encode(unsigned), secret, publicKey));
    assert.ok(
      signed.subarray(1, 65).every((b) => b === 0),
      "the maker's slot is untouched",
    );
    assert.ok(ed25519.verify(signed.subarray(65, 129), message, publicKey));
  });

  it("refuses a transaction this wallet does not sign", () => {
    const message = new Uint8Array([1, 0, 0, 1, ...new Uint8Array(32).fill(7), ...new Uint8Array(32), 0]);
    const unsigned = new Uint8Array([1, ...new Uint8Array(64), ...message]);
    assert.throws(() => signTransaction(base64.encode(unsigned), secret, publicKey));
  });
});
