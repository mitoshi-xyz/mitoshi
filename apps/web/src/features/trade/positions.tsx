"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import type { Perp } from "@mitoshi/venues/hyperliquid";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { price, upDown, usd } from "../format";
import { hlAccount } from "../hyperliquid/hl";
import { useAccountState } from "../hyperliquid/hooks";
import { sendHyperliquidHome } from "../private-wallets/home";

interface Props {
  wallet: PrivateWallet;
  perps: Perp[];
  mids: Record<string, number>;
}

/** One private wallet on Hyperliquid: its positions, orders, and the way home. */
function WalletPositions({ wallet, perps, mids }: Props) {
  const state = useAccountState(wallet);
  const queries = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const perpOf = (coin: string) => perps.find((p) => p.name === coin);

  async function run(what: string, job: () => Promise<unknown>) {
    setBusy(what);
    setError(null);
    try {
      await job();
      await queries.invalidateQueries({ queryKey: ["hyperliquid", "account", wallet.id] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const s = state.data;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-white/10 p-4 text-sm">
      <div className="flex items-baseline justify-between">
        <span className="font-mono">{wallet.address.slice(0, 10)}…</span>
        <span className="opacity-70">
          {s ? usd(s.perpValue + s.spotUsdc) : state.isPending ? "…" : "–"} · {wallet.status}
        </span>
      </div>
      {state.isError ? <p className="text-red-400 text-xs">Could not read the account: {state.error.message}</p> : null}
      {s?.positions.map((p) => {
        const mark = mids[p.coin] ?? p.entryPx;
        const perp = perpOf(p.coin);
        return (
          <div key={p.coin} className="flex items-center justify-between gap-2">
            <span>
              <span className={p.size > 0 ? "text-emerald-400" : "text-red-400"}>{p.size > 0 ? "Long" : "Short"}</span>{" "}
              {Math.abs(p.size)} {p.coin} · {p.leverage}× · entry {price(p.entryPx)} · mark {price(mark)}
              {p.liquidationPx ? ` · liq ${price(p.liquidationPx)}` : ""}
            </span>
            <span className={`font-mono ${upDown(p.unrealizedPnl)}`}>{usd(p.unrealizedPnl)}</span>
            {perp ? (
              <button
                type="button"
                disabled={busy !== null}
                className="rounded border border-white/20 px-2 py-0.5 text-xs disabled:opacity-40"
                onClick={() => void run("Closing", async () => (await hlAccount(wallet)).close(perp, p, mark))}
              >
                Close
              </button>
            ) : null}
          </div>
        );
      })}
      {s?.orders.map((o) => {
        const perp = perpOf(o.coin);
        return (
          <div key={o.oid} className="flex items-center justify-between gap-2 text-xs opacity-80">
            <span>
              {o.trigger
                ? `${o.trigger.kind} at ${price(o.trigger.px)}`
                : `${o.isBuy ? "Buy" : "Sell"} ${o.size} at ${price(o.px)}`}{" "}
              · {o.coin}
            </span>
            {perp ? (
              <button
                type="button"
                disabled={busy !== null}
                className="underline disabled:opacity-40"
                onClick={() => void run("Cancelling", async () => (await hlAccount(wallet)).cancel(perp, o.oid))}
              >
                Cancel
              </button>
            ) : null}
          </div>
        );
      })}
      {s && s.positions.length === 0 && wallet.status !== "returning" ? (
        <button
          type="button"
          disabled={busy !== null}
          className="self-start rounded-lg border border-white/20 px-3 py-1 text-xs disabled:opacity-40"
          onClick={() => void run("Sending home", () => sendHyperliquidHome(wallet.id))}
        >
          Send the money home (to a fresh shielded address)
        </button>
      ) : null}
      {busy ? <p className="text-xs opacity-70">{busy}…</p> : null}
      {error ? <p className="text-red-400 text-xs">{error}</p> : null}
    </li>
  );
}

/** Every live Hyperliquid private wallet with its positions. */
export function Positions({
  wallets,
  perps,
  mids,
}: {
  wallets: PrivateWallet[];
  perps: Perp[];
  mids: Record<string, number>;
}) {
  if (wallets.length === 0) {
    return <p className="text-sm opacity-60">No positions yet. Each one opens from its own new wallet.</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {wallets.map((w) => (
        <WalletPositions key={w.id} wallet={w} perps={perps} mids={mids} />
      ))}
    </ul>
  );
}
