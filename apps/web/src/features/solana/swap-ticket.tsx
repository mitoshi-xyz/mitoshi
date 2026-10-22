"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { SOL_MINT, type SolToken } from "@mitoshi/venues/solana";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cx, TxCta, type TxPhase } from "@/kit";
import { openFund } from "../private-wallets/drawers";
import { markTrading } from "../private-wallets/home";
import { BUY_SOL, SELL_SHARES } from "./constants";
import { useHoldings } from "./hooks";
import { solAccount, solMarket } from "./sol";

const QUOTE_DEBOUNCE_MS = 400;
const PCT = 100;
const HIGH_IMPACT = 0.03;
const DECIMAL_BASE = 10;
const LAMPORT_DECIMALS = 9;
const OUT_SIG = 6;
const IMPACT_DIGITS = 2;

function toUnits(amount: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = amount.trim().split(".");
  return (
    BigInt(whole || "0") * BigInt(DECIMAL_BASE) ** BigInt(decimals) +
    BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0")
  );
}

const fromUnits = (v: bigint, decimals: number) => Number(v) / DECIMAL_BASE ** decimals;

/** Buy a token with SOL, or sell it back, from a private Solana wallet (Jupiter Ultra signs nothing for us). */
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
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
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
  const out = quote.data ? fromUnits(quote.data.outAmount, side === "buy" ? token.decimals : LAMPORT_DECIMALS) : 0;

  async function swap() {
    if (!wallet || units <= 0n) return;
    setResult(null);
    setPhase("signing");
    try {
      const account = await solAccount(wallet);
      setPhase("sent");
      const res = side === "buy" ? await account.buy(token.mint, units) : await account.sell(token.mint, units);
      setPhase("confirmed");
      markTrading(wallet.id, `${side === "buy" ? "Bought" : "Sold"} ${token.symbol}`);
      setResult({
        ok: true,
        text: `${side === "buy" ? "Bought" : "Sold"} ${token.symbol} · ${res.signature.slice(0, 10)}…`,
      });
      setAmount("");
      void queries.invalidateQueries({ queryKey: ["solana", "holdings", wallet.id] });
    } catch (e) {
      setPhase("failed");
      setResult({ ok: false, text: `${e instanceof Error ? e.message : String(e)}. No money moved.` });
    }
  }

  const impact = quote.data?.priceImpact ?? 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-1 p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setAmount("");
            }}
            className={cx(
              "h-10 rounded-md font-semibold capitalize",
              side === s ? (s === "buy" ? "bg-up text-bg" : "bg-down text-bg") : "text-ink-2 hover:text-ink",
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="type-label text-muted">{side === "buy" ? "Pay" : "Sell"}</span>
        <div className="relative">
          <input
            className="h-12 w-full rounded-lg border border-hairline bg-surface-1 px-3 font-mono text-[18px] outline-none focus:border-strong"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">
            {side === "buy" ? "SOL" : token.symbol}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {side === "buy"
            ? BUY_SOL.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmount(String(a))}
                  className="h-8 rounded-full bg-surface-1 text-[12px] text-ink-2 hover:text-ink"
                >
                  {a} SOL
                </button>
              ))
            : SELL_SHARES.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!held}
                  onClick={() => held && setAmount(String((held.uiAmount * p) / PCT))}
                  className="h-8 rounded-full bg-surface-1 text-[12px] text-ink-2 hover:text-ink disabled:opacity-40"
                >
                  {p === PCT ? "All" : `${p}%`}
                </button>
              ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-surface-1 p-3 text-[13px]">
        <dt className="text-ink-2">You get ≈</dt>
        <dd className="num text-right">
          {quote.isFetching ? "…" : out ? `${out.toPrecision(OUT_SIG)} ${side === "buy" ? token.symbol : "SOL"}` : "–"}
        </dd>
        <dt className="text-ink-2">Price impact</dt>
        <dd className={cx("num text-right", impact > HIGH_IMPACT ? "text-warning" : "")}>
          {quote.data ? `${(impact * PCT).toFixed(IMPACT_DIGITS)}%` : "–"}
        </dd>
        <dt className="text-ink-2">Route</dt>
        <dd className="truncate text-right">{quote.data?.route.join(" → ") || "–"}</dd>
        <dt className="text-ink-2">Mitoshi fee</dt>
        <dd className="text-right">none on trades</dd>
      </dl>
      {quote.isError ? <p className="text-[12px] text-down">No route for that amount: {quote.error.message}</p> : null}
      <TxCta
        tone={side === "buy" ? "up" : "down"}
        phase={phase === "confirmed" || phase === "failed" ? "idle" : phase}
        label={`${side === "buy" ? "Buy" : "Sell"} ${token.symbol}`}
        onClick={() => void swap()}
        {...(!wallet ? { fix: { label: "Fund a Solana wallet first", onClick: () => openFund("solana") } } : {})}
      />
      {!wallet ? <p className="text-center text-[12px] text-ink-2">{waiting}</p> : null}
      {result ? (
        <p
          className={cx(
            "rounded-lg px-3 py-2 text-center text-[13px]",
            result.ok ? "bg-up-wash text-up" : "bg-down-wash text-down",
          )}
        >
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
