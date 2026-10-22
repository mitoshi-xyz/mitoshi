import type { PrivateFetch } from "@mitoshi/net";
import {
  DUST_LAMPORTS,
  JUP_API,
  SIGNATURE_FEE_LAMPORTS,
  SOL_MINT,
  SOLANA_RPC,
  SWAP_RESERVE_LAMPORTS,
} from "./constants.ts";
import { signTransaction, transferTransaction } from "./tx.ts";

export interface SolanaKeyPair {
  secret: Uint8Array;
  publicKey: Uint8Array;
  address: string;
}

export interface Holding {
  mint: string;
  /** Base units. */
  amount: bigint;
  uiAmount: number;
}

export interface Holdings {
  lamports: bigint;
  tokens: Holding[];
}

export interface SwapResult {
  signature: string;
  inAmount: string;
  outAmount: string;
  /** Jupiter's USD value of each side at the time of the swap (null if it gave none). */
  inUsd: number | null;
  outUsd: number | null;
}

type Json = Record<string, unknown>;

/**
 * One private wallet on Solana. Swaps go through Jupiter Ultra (it routes, then broadcasts the
 * transaction this wallet signs); the trip home is one plain SOL transfer. Every call is OHTTP.
 */
export class SolanaAccount {
  readonly address: string;
  private readonly send: PrivateFetch;
  private readonly key: SolanaKeyPair;

  constructor(send: PrivateFetch, key: SolanaKeyPair) {
    this.send = send;
    this.key = key;
    this.address = key.address;
  }

  private async json<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await this.send(url, {
      ...init,
      headers: { "content-type": "application/json", accept: "application/json" },
    });
    const body = (await res.json()) as T & { error?: unknown; errorMessage?: unknown };
    if (!res.ok) throw new Error(`Solana: ${String(body.errorMessage ?? body.error ?? `HTTP ${res.status}`)}`);
    return body;
  }

  private async rpc<T>(method: string, params: unknown[]): Promise<T> {
    const res = await this.json<{ result?: T; error?: { message?: string } }>(SOLANA_RPC, {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (res.error) throw new Error(`Solana RPC: ${res.error.message ?? "error"}`);
    return res.result as T;
  }

  async holdings(): Promise<Holdings> {
    const h = await this.json<{ amount?: string; tokens?: Record<string, { amount: string; uiAmount: number }[]> }>(
      `${JUP_API}/ultra/v1/holdings/${this.address}`,
    );
    const tokens = Object.entries(h.tokens ?? {}).map(([mint, accounts]) => ({
      mint,
      amount: accounts.reduce((n, a) => n + BigInt(a.amount), 0n),
      uiAmount: accounts.reduce((n, a) => n + a.uiAmount, 0),
    }));
    return { lamports: BigInt(h.amount ?? "0"), tokens: tokens.filter((t) => t.amount > 0n) };
  }

  /** Swaps `amount` base units of `inputMint` for `outputMint` with Jupiter Ultra. */
  async swap(inputMint: string, outputMint: string, amount: bigint): Promise<SwapResult> {
    const q = new URLSearchParams({ inputMint, outputMint, amount: amount.toString(), taker: this.address });
    const order = await this.json<Json>(`${JUP_API}/ultra/v1/order?${q}`);
    if (typeof order.transaction !== "string" || !order.transaction) {
      throw new Error(
        `no swap available: ${String(order.errorMessage ?? order.error ?? "Jupiter returned no transaction")}`,
      );
    }
    const signedTransaction = signTransaction(order.transaction, this.key.secret, this.key.publicKey);
    const done = await this.json<Json>(`${JUP_API}/ultra/v1/execute`, {
      method: "POST",
      body: JSON.stringify({ signedTransaction, requestId: order.requestId }),
    });
    if (done.status !== "Success") throw new Error(`swap failed: ${String(done.error ?? done.status)}`);
    return {
      signature: String(done.signature),
      inAmount: String(done.inputAmountResult ?? order.inAmount),
      outAmount: String(done.outputAmountResult ?? order.outAmount),
      inUsd: typeof order.inUsdValue === "number" ? order.inUsdValue : null,
      outUsd: typeof order.outUsdValue === "number" ? order.outUsdValue : null,
    };
  }

  /** Buys a token with SOL, keeping back enough SOL for fees and rent. */
  async buy(mint: string, lamports: bigint): Promise<SwapResult> {
    const { lamports: have } = await this.holdings();
    const spend = lamports < have - BigInt(SWAP_RESERVE_LAMPORTS) ? lamports : have - BigInt(SWAP_RESERVE_LAMPORTS);
    if (spend <= 0n) throw new Error("not enough SOL left after fees");
    return this.swap(SOL_MINT, mint, spend);
  }

  /** Sells all (or `amount`) of a token back to SOL. */
  async sell(mint: string, amount?: bigint): Promise<SwapResult> {
    const holding = (await this.holdings()).tokens.find((t) => t.mint === mint);
    if (!holding) throw new Error("this wallet does not hold that token");
    return this.swap(mint, SOL_MINT, amount ?? holding.amount);
  }

  /** SOL that can be sent home (everything minus the transfer fee), or 0 when only dust is left. */
  async sendable(): Promise<bigint> {
    const balance = BigInt(
      await this.rpc<{ value: number }>("getBalance", [this.address, { commitment: "confirmed" }]).then((r) => r.value),
    );
    const out = balance - BigInt(SIGNATURE_FEE_LAMPORTS);
    return out < BigInt(DUST_LAMPORTS) ? 0n : out;
  }

  /** Sends `lamports` to 1Click's deposit address on Solana; returns the signature. */
  async sendSol(destination: string, lamports: bigint): Promise<string> {
    const { value } = await this.rpc<{ value: { blockhash: string } }>("getLatestBlockhash", [
      { commitment: "confirmed" },
    ]);
    const tx = transferTransaction(this.key.secret, this.key.publicKey, destination, lamports, value.blockhash);
    return this.rpc<string>("sendTransaction", [tx, { encoding: "base64", preflightCommitment: "confirmed" }]);
  }
}
