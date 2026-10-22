import { ed25519 } from "@noble/curves/ed25519.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { base58 } from "@scure/base";
import { HDKey } from "@scure/bip32";
import { COIN_TYPE, MITOSHI_ACCOUNT, PATH_PURPOSE, VENUE_BRANCH } from "./constants.ts";
import type { Venue } from "./registry.ts";

const HARDENED = 0x8000_0000;
const UNCOMPRESSED_PREFIX_BYTES = 1;
const EVM_ADDRESS_BYTES = 20;
const SLIP10_ED25519_KEY = new TextEncoder().encode("ed25519 seed");
const SLIP10_HALF = 32;
const SLIP10_INDEX_BYTES = 4;

/**
 * Every private wallet has its own key from the device seed, on a branch only Mitoshi uses, with
 * every level hardened: one wallet's key or address says nothing about any other's. The same
 * 24 words that restore the Zcash wallet restore every private wallet.
 */
export function walletPath(venue: Venue, index: number): string {
  const coin = venue === "solana" ? COIN_TYPE.solana : COIN_TYPE.evm;
  return `m/${PATH_PURPOSE}'/${coin}'/${MITOSHI_ACCOUNT}'/${VENUE_BRANCH[venue]}'/${index}'`;
}

export interface EvmKey {
  privateKey: Uint8Array;
  address: `0x${string}`;
}

/** EIP-55 checksummed address for a secp256k1 private key. */
export function evmAddress(privateKey: Uint8Array): `0x${string}` {
  const pub = secp256k1.getPublicKey(privateKey, false).slice(UNCOMPRESSED_PREFIX_BYTES);
  const lower = bytesToHex(keccak_256(pub).slice(-EVM_ADDRESS_BYTES));
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(lower)));
  const CHECKSUM_NIBBLE = 8;
  const HEX = 16;
  const sum = [...lower].map((c, i) => (Number.parseInt(hash[i] ?? "0", HEX) >= CHECKSUM_NIBBLE ? c.toUpperCase() : c));
  return `0x${sum.join("")}`;
}

/** An EVM key (Polymarket, Hyperliquid) for one private wallet. */
export function evmKey(seed: Uint8Array, venue: Exclude<Venue, "solana">, index: number): EvmKey {
  const node = HDKey.fromMasterSeed(seed).derive(walletPath(venue, index));
  if (!node.privateKey) throw new Error("no private key at that path");
  return { privateKey: node.privateKey, address: evmAddress(node.privateKey) };
}

export interface SolanaKey {
  /** 32-byte ed25519 secret seed. */
  secret: Uint8Array;
  publicKey: Uint8Array;
  address: string;
}

/** SLIP-0010 ed25519 derivation (hardened only, as ed25519 requires). */
export function slip10(seed: Uint8Array, path: string): Uint8Array {
  let I = hmac(sha512, SLIP10_ED25519_KEY, seed);
  let key = I.slice(0, SLIP10_HALF);
  let chain = I.slice(SLIP10_HALF);
  for (const part of path.split("/").slice(1)) {
    if (!part.endsWith("'")) throw new Error("ed25519 paths must be fully hardened");
    const index = (Number.parseInt(part.slice(0, -1), 10) + HARDENED) >>> 0;
    const data = new Uint8Array(1 + SLIP10_HALF + SLIP10_INDEX_BYTES);
    data.set(key, 1);
    new DataView(data.buffer).setUint32(1 + SLIP10_HALF, index);
    I = hmac(sha512, chain, data);
    key = I.slice(0, SLIP10_HALF);
    chain = I.slice(SLIP10_HALF);
  }
  return key;
}

/** A Solana key for one private wallet. */
export function solanaKey(seed: Uint8Array, index: number): SolanaKey {
  const secret = slip10(seed, walletPath("solana", index));
  const publicKey = ed25519.getPublicKey(secret);
  return { secret, publicKey, address: base58.encode(publicKey) };
}

/** The address a private wallet is known by on its venue. */
export function walletAddress(seed: Uint8Array, venue: Venue, index: number): string {
  return venue === "solana" ? solanaKey(seed, index).address : evmKey(seed, venue, index).address;
}
