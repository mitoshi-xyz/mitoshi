import { concat, encodeAbiParameters, getContractAddress, type Hex, keccak256, numberToHex, pad } from "viem";
import {
  BEACON_PROXY_CODE,
  BEACON_PROXY_LENGTH_SHIFT,
  BEACON_PROXY_PREFIX,
  BEACON_PROXY_PREFIX_BYTES,
  DEPOSIT_WALLET_BEACON,
  DEPOSIT_WALLET_FACTORY,
} from "./constants.ts";

const HEX_CHARS_PER_BYTE = 2;

/**
 * The Deposit Wallet a signer gets on Polymarket, known before it is deployed
 * (docs.polymarket.com/trading/wallets-auth, "Derive a Deposit Wallet Address"): CREATE2 from the
 * factory, salted with keccak(abi.encode(factory, bytes32(signer))), over the beacon proxy's init
 * code. This is where a new private wallet's funding is sent, before anything is on chain.
 */
export function depositWalletAddress(signer: Hex): Hex {
  const args = encodeAbiParameters(
    [{ type: "address" }, { type: "bytes32" }],
    [DEPOSIT_WALLET_FACTORY, pad(signer, { size: 32 })],
  );
  const argBytes = BigInt((args.length - HEX_CHARS_PER_BYTE) / HEX_CHARS_PER_BYTE);
  const prefix = numberToHex(BEACON_PROXY_PREFIX + (argBytes << BEACON_PROXY_LENGTH_SHIFT), {
    size: BEACON_PROXY_PREFIX_BYTES,
  });
  const initCodeHash = keccak256(concat([prefix, DEPOSIT_WALLET_BEACON, ...BEACON_PROXY_CODE, args]));
  return getContractAddress({
    opcode: "CREATE2",
    from: DEPOSIT_WALLET_FACTORY,
    salt: keccak256(args),
    bytecodeHash: initCodeHash,
  });
}
