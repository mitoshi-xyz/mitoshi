"use client";

import { type PrivateWallet, solanaKey } from "@mitoshi/engine";
import { createPrivateFetch, proxiedImage } from "@mitoshi/net";
import { SolanaAccount, SolanaMarket } from "@mitoshi/venues/solana";
import { RELAY } from "@/constants";
import { deviceSeed } from "../wallet/wallet-store";

/** Public Solana token data, over OHTTP. */
export const solMarket = new SolanaMarket(createPrivateFetch(RELAY));

const accounts = new Map<string, SolanaAccount>();

/** The Solana account of one private wallet, signing with that wallet's own key. */
export async function solAccount(w: PrivateWallet): Promise<SolanaAccount> {
  const cached = accounts.get(w.id);
  if (cached) return cached;
  const key = solanaKey(await deviceSeed(), w.index);
  if (key.address !== w.address) throw new Error("wallet key does not match its address");
  const account = new SolanaAccount(createPrivateFetch(RELAY), key);
  accounts.set(w.id, account);
  return account;
}

export function solImage(src: string | null): string | null {
  return src ? proxiedImage(RELAY, src) : null;
}
