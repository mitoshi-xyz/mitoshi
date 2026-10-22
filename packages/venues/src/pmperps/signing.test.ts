import assert from "node:assert/strict";
import { test } from "node:test";
import { encode } from "@msgpack/msgpack";
import { keccak256, recoverTypedDataAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { PERPS_DEPOSIT_CONTRACT } from "./constants.ts";
import { opHash, signOp, signWithdraw } from "./signing.ts";

const COID = "7f9e4a2b6c8d0e1f1234567890abcdef";

test("the op hash drops undefined entries at every depth (docs: Trading, step 3)", () => {
  const op = ["createOrders", [[1, true, "65000", "0.01", "ioc", false, undefined, COID, undefined]]] as const;
  const compact = ["createOrders", [[1, true, "65000", "0.01", "ioc", false, COID]]];
  assert.equal(opHash(op), keccak256(encode(compact)));
});

test("a TP/SL trigger stays a nested array inside the compact order", () => {
  const op = [
    "createOrders",
    [[1, false, undefined, "0.01", undefined, false, true, undefined, [true, "70000", "tp"]]],
    "order",
  ];
  const compact = ["createOrders", [[1, false, "0.01", false, true, [true, "70000", "tp"]]], "order"];
  assert.equal(opHash(op), keccak256(encode(compact)));
});

test("an Op signature recovers to the proxy that signed it", async () => {
  const key = generatePrivateKey();
  const op = ["cancelOrders", [42]] as const;
  const s = await signOp(key, op);
  const signer = await recoverTypedDataAddress({
    domain: { name: "Polymarket", version: "1", chainId: 137 },
    primaryType: "Op",
    types: {
      Op: [
        { name: "data", type: "bytes32" },
        { name: "salt", type: "uint64" },
        { name: "ts", type: "uint64" },
      ],
    },
    message: { data: opHash(op), salt: BigInt(s.salt), ts: BigInt(s.ts) },
    signature: s.sig,
  });
  assert.equal(signer, privateKeyToAccount(key).address);
});

test("a withdrawal is signed against the deposit contract, with ts in seconds", async () => {
  const key = generatePrivateKey();
  const account = privateKeyToAccount(key).address;
  const args = {
    account,
    token: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
    amount: 10_000_000n,
    to: account,
  } as const;
  const s = await signWithdraw(key, args);
  assert.ok(s.ts < 10_000_000_000, "seconds, not milliseconds");
  const signer = await recoverTypedDataAddress({
    domain: { name: "Polymarket", version: "1", chainId: 137, verifyingContract: PERPS_DEPOSIT_CONTRACT },
    primaryType: "Withdraw",
    types: {
      Withdraw: [
        { name: "account", type: "address" },
        { name: "token", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "fee", type: "uint256" },
        { name: "to", type: "address" },
        { name: "salt", type: "uint64" },
        { name: "ts", type: "uint64" },
      ],
    },
    message: { ...args, fee: 0n, salt: BigInt(s.salt), ts: BigInt(s.ts) },
    signature: s.sig,
  });
  assert.equal(signer, account);
});
