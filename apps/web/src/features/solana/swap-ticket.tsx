"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { SOL_MINT, type SolToken } from "@mitoshi/venues/solana";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { markTrading } from "../private-wallets/home";
import { useHoldings } from "./hooks";
import { solAccount, solMarket } from "./sol";

const QUOTE_DEBOUNCE_MS = 400;
const PCT = 100;
const HIGH_IMPACT = 0.03;
const QUARTER = 25;
const HALF = 50;
const ALL = 100;
const SELL_SHARES = [QUARTER, HALF, ALL] as const;
const DECIMAL_BASE = 10;
const ADDRESS_HEAD = 6;
const OUT_SIG_DIGITS = 6;
const SOL_SHOWN_DECIMALS = 4;
/** SOL has 9 decimals (lamports). */
const LAMPORT_DECIMALS = 9;

type Step = { kind: "idle" } | { kind: "working" } | { kind: "done"; text: string } | { kind: "failed"; text: string };

function toUnits(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.trim().split(".");
  return (
    BigInt(whole || "0") * BigInt(DECIMAL_BASE) ** BigInt(decimals) +
    BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")
  );
}

const fromUnits = (v: bigint, decimals: number) => Number(v) / DECIMAL_BASE ** decimals;

/** Buy a token with SOL, or sell it back, from a private Solana wallet (Jupiter Ultra). */
export function SwapTicket({
  token,
  wallet,
  waiting,
}: {
  token: SolToken;
  wallet: PrivateWallet | undefined;
  waiting: string;
}) {
  const queries = useQueryClient();
  const holdings = useHoldings(wallet);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [debounced, setDebounced] = useState("");
  const [step, setStep] = useState<Step>({ kind: "idle" });
  useEffect(() => {
    const t = setTimeout(() => setDebounced(amount), QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [amount]);

  const held = holdings.data?.tokens.find((t) => t.mint === token.mint);
  const inDecimals = side === "buy" ? LAMPORT_DECIMALS : token.decimals;
  const units = Number(debounced) > 0 ? toUnits(debounced, inDecimals) : 0n;
  const quote = useQuery({
    queryKey: ["solana", "quote", side, token.mint, units.toString()],
    queryFn: () =>
      side === "buy" ? solMarket.quote(SOL_MINT, token.mint, units) : solMarket.quote(token.mint, SOL_MINT, units),
    enabled: units > 0n,
  });
  const outDecimals = side === "buy" ? token.decimals : LAMPORT_DECIMALS;
  const out = quote.data ? fromUnits(quote.data.outAmount, outDecimals) : 0;

  async function swap() {
    if (!wallet || units <= 0n) return;
    setStep({ kind: "working" });
    try {
      const account = await solAccount(wallet);
      const res = side === "buy" ? await account.buy(token.mint, units) : await account.sell(token.mint, units);
      markTrading(wallet.id, `${side === "buy" ? "Bought" : "Sold"} ${token.symbol}`);
      setStep({ kind: "done", text: `Done: ${res.signature.slice(0, 10)}…` });
      void queries.invalidateQueries({ queryKey: ["solana", "holdings", wallet.id] });
    } catch (e) {
      setStep({ kind: "failed", text: e instanceof Error ? e.message : String(e) });
    }
  }

  const solBalance = holdings.data ? fromUnits(holdings.data.lamports, LAMPORT_DECIMALS) : 0;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-4">
      <div className="grid grid-cols-2 gap-2">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setAmount("");
            }}
            className={`rounded-lg py-2 font-medium capitalize ${side === s ? (s === "buy" ? "bg-emerald-500 text-black" : "bg-red-500 text-black") : "border border-white/20"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {wallet ? (
        <p className="text-xs opacity-70">
          Private wallet <span className="font-mono">{wallet.address.slice(0, ADDRESS_HEAD)}…</span> ·{" "}
          {solBalance.toFixed(SOL_SHOWN_DECIMALS)} SOL
          {held ? ` · ${held.uiAmount} ${token.symbol}` : ""}
        </p>
      ) : (
        <p className="text-amber-400 text-xs">
          {waiting}{" "}
          <Link href="/wallets" className="underline">
            Private wallets
          </Link>
        </p>
      )}
      <label className="flex flex-col gap-1 text-xs opacity-80">
        {side === "buy" ? "Pay (SOL)" : `Sell (${token.symbol})`}
        <input
          className="rounded-lg border border-white/20 bg-transparent px-3 py-2 font-mono text-sm"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      {side === "sell" && held ? (
        <div className="flex gap-2 text-xs">
          {SELL_SHARES.map((p) => (
            <button
              key={p}
              type="button"
              className="underline"
              onClick={() => setAmount(String((held.uiAmount * p) / PCT))}
            >
              {p}%
            </button>
          ))}
        </div>
      ) : null}
      <dl className="grid grid-cols-2 gap-y-1 text-xs">
        <dt className="opacity-60">You get ≈</dt>
        <dd className="text-right font-mono">
          {quote.isFetching
            ? "…"
            : out
              ? `${out.toPrecision(OUT_SIG_DIGITS)} ${side === "buy" ? token.symbol : "SOL"}`
              : "–"}
        </dd>
        <dt className="opacity-60">Price impact</dt>
        <dd className={`text-right font-mono ${(quote.data?.priceImpact ?? 0) > HIGH_IMPACT ? "text-amber-400" : ""}`}>
          {quote.data ? `${(quote.data.priceImpact * PCT).toFixed(2)}%` : "–"}
        </dd>
        <dt className="opacity-60">Route</dt>
        <dd className="truncate text-right">{quote.data?.route.join(" → ") || "–"}</dd>
        <dt className="opacity-60">Mitoshi fee</dt>
        <dd className="text-right font-mono">none on trades</dd>
      </dl>
      {quote.isError ? <p className="text-red-400 text-xs">No route: {quote.error.message}</p> : null}
      <button
        type="button"
        disabled={!wallet || units <= 0n || !quote.data || step.kind === "working"}
        onClick={() => void swap()}
        className="rounded-lg bg-white py-2 font-medium text-black capitalize disabled:opacity-40"
      >
        {side} {token.symbol}
      </button>
      {step.kind === "working" ? (
        <p className="text-xs opacity-70">Signing with this wallet's key; Jupiter sends it…</p>
      ) : null}
      {step.kind === "done" ? <p className="text-emerald-400 text-xs">{step.text}</p> : null}
      {step.kind === "failed" ? <p className="text-red-400 text-xs">{step.text}</p> : null}
    </div>
  );
}
