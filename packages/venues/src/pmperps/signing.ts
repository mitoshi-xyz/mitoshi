import { encode } from "@msgpack/msgpack";
import { type Hex, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PERPS_CHAIN_ID, PERPS_DEPOSIT_CONTRACT, PERPS_DOMAIN_NAME, PERPS_DOMAIN_VERSION } from "./constants.ts";

/**
 * Polymarket Perps request signing (docs: Trading, Authenticated Sessions, Fund Your Account).
 * Three kinds, each an EIP-712 signature with a fresh salt and the current time:
 *   - Op: a trading command, signed by the proxy key over keccak256(msgpack(compact op)).
 *   - CreateProxy: the account owner authorising a proxy key.
 *   - Withdraw: the account owner moving pUSD out, checked on-chain against the deposit contract.
 */

type Signable = boolean | number | string | undefined | readonly Signable[];

const domain = { name: PERPS_DOMAIN_NAME, version: PERPS_DOMAIN_VERSION, chainId: PERPS_CHAIN_ID } as const;

/** A random uint32 salt for one signed request. */
export function salt(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/** The docs' compact form: `undefined` entries are dropped from every array, at every depth. */
function compact(value: Signable): Signable {
  return Array.isArray(value) ? value.filter((v) => v !== undefined).map(compact) : value;
}

/** keccak256 of the MessagePack-encoded compact operation. */
export function opHash(op: Signable): Hex {
  return keccak256(encode(compact(op)));
}

export interface Signed {
  sig: Hex;
  salt: number;
  ts: number;
}

/** Signs a trading command with the proxy key (ts in milliseconds). */
export async function signOp(proxyKey: Hex, op: Signable): Promise<Signed> {
  const s = salt();
  const ts = Date.now();
  const sig = await privateKeyToAccount(proxyKey).signTypedData({
    domain,
    primaryType: "Op",
    types: {
      Op: [
        { name: "data", type: "bytes32" },
        { name: "salt", type: "uint64" },
        { name: "ts", type: "uint64" },
      ],
    },
    message: { data: opHash(op), salt: BigInt(s), ts: BigInt(ts) },
  });
  return { sig, salt: s, ts };
}

/** The owner authorises a proxy address until `expiry` (ms). */
export async function signCreateProxy(ownerKey: Hex, proxy: Hex, expiry: number): Promise<Signed> {
  const s = salt();
  const ts = Date.now();
  const sig = await privateKeyToAccount(ownerKey).signTypedData({
    domain,
    primaryType: "CreateProxy",
    types: {
      CreateProxy: [
        { name: "addr", type: "address" },
        { name: "exp", type: "uint64" },
        { name: "salt", type: "uint64" },
        { name: "ts", type: "uint64" },
      ],
    },
    message: { addr: proxy, exp: BigInt(expiry), salt: BigInt(s), ts: BigInt(ts) },
  });
  return { sig, salt: s, ts };
}

const MS_PER_SECOND = 1000;

/** The owner withdraws `amount` (pUSD base units) to `to`. ts is in seconds: the contract checks it. */
export async function signWithdraw(
  ownerKey: Hex,
  args: { account: Hex; token: Hex; amount: bigint; to: Hex },
): Promise<Signed> {
  const s = salt();
  const ts = Math.floor(Date.now() / MS_PER_SECOND);
  const sig = await privateKeyToAccount(ownerKey).signTypedData({
    domain: { ...domain, verifyingContract: PERPS_DEPOSIT_CONTRACT },
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
    message: { ...args, fee: 0n, salt: BigInt(s), ts: BigInt(ts) },
  });
  return { sig, salt: s, ts };
}
