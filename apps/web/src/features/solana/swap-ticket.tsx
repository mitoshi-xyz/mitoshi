"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { SOL_MINT, type SolToken } from "@mitoshi/venues/solana";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { cue, cx, Keypad, pressKey, TxCta, type TxPhase } from "@/kit";
import { openFund } from "../private-wallets/drawers";
import { recordTrade } from "../private-wallets/home";
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
/** Room after the typed digits, so the amount stays centred as it grows. */
const CARET_CH = 0.5;
/** Amounts are typed to this many places (SOL; a token's own decimals cap it further). */
const AMOUNT_DECIMALS = 6;

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
  side,
  onSide,
  keypad = false,
  sideInHeader = false,
}: {
  token: SolToken;
  wallet: PrivateWallet | undefined;
  side: "buy" | "sell";
  onSide: (s: "buy" | "sell") => void;
  /** Phones: the amount uses the keypad. */
  keypad?: boolean;
  /** In the sheet the side sits in its header. */
  sideInHeader?: boolean;
}) {
  const queries = useQueryClient();
  const holdings = useHoldings(wallet);
  const [amount, setAmount] = useState("");
  const [debounced, setDebounced] = useState("");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(amount), QUOTE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [amount]);
  // A new side starts from an empty amount (SOL in, or the token in).
  useEffect(() => setAmount(""), [side]);

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
      cue("fill");
      recordTrade(wallet.id, {
        at: Date.now(),
        label: `${side === "buy" ? "Bought" : "Sold"} ${token.symbol}`,
        asset: token.mint,
        side,
        inAmount: res.inAmount,
        outAmount: res.outAmount,
        usd: res.inUsd,
        ref: res.signature,
      });
      setResult({
        ok: true,
        text: `${side === "buy" ? "Bought" : "Sold"} ${token.symbol} · ${res.signature.slice(0, 10)}…`,
      });
      setAmount("");
      void queries.invalidateQueries({ queryKey: ["solana", "holdings", wallet.id] });
    } catch (e) {
      setPhase("failed");
      cue("error");
      setResult({ ok: false, text: `${e instanceof Error ? e.message : String(e)}. No money moved.` });
    }
  }

  const impact = quote.data?.priceImpact ?? 0;
  const unit = side === "buy" ? "SOL" : token.symbol;
  const cells = [
    {
      label: "You get",
      value: quote.isFetching
        ? "…"
        : out
          ? `${out.toPrecision(OUT_SIG)} ${side === "buy" ? token.symbol : "SOL"}`
          : "–",
    },
    {
      label: "Impact",
      value: quote.data ? `${(impact * PCT).toFixed(IMPACT_DIGITS)}%` : "–",
      tone: impact > HIGH_IMPACT ? "text-warning" : "",
    },
    { label: "Route", value: quote.data?.route.join(" → ") || "Jupiter" },
  ];
  return (
    <div className="flex flex-col gap-3">
      {sideInHeader ? null : (
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
          {(["buy", "sell"] as const).map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => onSide(x)}
              className={cx(
                "h-10 rounded-lg font-semibold capitalize",
                side === x ? (x === "buy" ? "bg-up text-bg" : "bg-down text-bg") : "text-ink-2 hover:text-ink",
              )}
            >
              {x}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col items-center gap-1 py-1">
        <label className="flex items-baseline justify-center gap-1.5">
          <input
            inputMode={keypad ? "none" : "decimal"}
            readOnly={keypad}
            aria-label={`Amount in ${unit}`}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            style={{ width: `${Math.max(1, amount.length || 1) + CARET_CH}ch` }}
            className="num max-w-[10ch] bg-transparent text-center font-semibold text-[48px] leading-none outline-none placeholder:text-muted"
          />
          <span className="font-semibold text-[18px] text-muted">{unit}</span>
        </label>
        {side === "sell" && held ? (
          <button
            type="button"
            onClick={() => setAmount(String(held.uiAmount))}
            className="num text-[13px] text-ink-2 hover:text-ink"
          >
            {held.uiAmount} held · Max
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {side === "buy"
          ? BUY_SOL.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                className="h-8 rounded-full bg-surface-2 text-[12px] text-ink-2 hover:text-ink"
              >
                {a}
              </button>
            ))
          : SELL_SHARES.map((p) => (
              <button
                key={p}
                type="button"
                disabled={!held}
                onClick={() => held && setAmount(String((held.uiAmount * p) / PCT))}
                className="h-8 rounded-full bg-surface-2 text-[12px] text-ink-2 hover:text-ink disabled:opacity-40"
              >
                {p === PCT ? "All" : `${p}%`}
              </button>
            ))}
      </div>
      {keypad ? (
        <Keypad
          onKey={(k) =>
            setAmount(
              pressKey(amount, k, Math.min(AMOUNT_DECIMALS, side === "buy" ? LAMPORT_DECIMALS : token.decimals)),
            )
          }
        />
      ) : null}
      <div className="grid grid-cols-3 divide-x divide-[var(--hairline)] rounded-xl bg-surface-2 py-2.5">
        {cells.map((c) => (
          <span key={c.label} className="flex min-w-0 flex-col items-center px-1 leading-tight">
            <span className="text-[11px] text-muted">{c.label}</span>
            <span className={cx("num max-w-full truncate font-semibold text-[13px]", c.tone)}>{c.value}</span>
          </span>
        ))}
      </div>
      {quote.isError ? <p className="text-center text-[12px] text-down">No route for that amount</p> : null}
      <TxCta
        tone={side === "buy" ? "up" : "down"}
        phase={phase === "confirmed" || phase === "failed" ? "idle" : phase}
        label={`${side === "buy" ? "Buy" : "Sell"} ${token.symbol}`}
        onClick={() => void swap()}
        {...(!wallet ? { fix: { label: "Fund a private wallet", onClick: () => openFund("solana") } } : {})}
      />
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
