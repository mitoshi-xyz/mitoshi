"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import type { Perp } from "@mitoshi/venues/hyperliquid";
import { useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { useState } from "react";
import { cx, EmptyState, RollingNumber, Skeleton, Wait } from "@/kit";
import { price, upDown } from "../format";
import { hlAccount } from "../hyperliquid/hl";
import { useAccountState } from "../hyperliquid/hooks";
import { Mark } from "../marks/mark";
import { sendHyperliquidHome } from "../private-wallets/home";
import { MASK, useHideAmounts } from "../shell/prefs";

const ADDRESS_HEAD = 8;

interface Props {
  wallet: PrivateWallet;
  perps: Perp[];
  mids: Record<string, number>;
}

function WalletPositions({ wallet, perps, mids }: Props) {
  const state = useAccountState(wallet);
  const queries = useQueryClient();
  const [hidden] = useHideAmounts();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const perpOf = (coin: string) => perps.find((p) => p.name === coin);

  async function run(verb: string, job: () => Promise<unknown>) {
    setBusy(verb);
    setError(null);
    try {
      await job();
      await queries.invalidateQueries({ queryKey: ["hyperliquid", "account", wallet.id] });
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)}. Your money is where it was.`);
    } finally {
      setBusy(null);
    }
  }

  const s = state.data;
  if (state.isPending) return <Skeleton className="h-20" label="Reading the wallet" />;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-1 p-3">
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span>
          Wallet <span className="font-mono">{wallet.address.slice(0, ADDRESS_HEAD)}…</span>
        </span>
        <span className="capitalize">{wallet.status === "returning" ? "coming home" : wallet.status}</span>
      </div>
      {s?.positions.map((p) => {
        const mark = mids[p.coin] ?? p.entryPx;
        const perp = perpOf(p.coin);
        const long = p.size > 0;
        return (
          <div key={p.coin} className="flex flex-col gap-2 rounded-md bg-surface-2/60 p-2.5">
            <div className="flex items-center gap-2">
              <Mark symbol={p.coin} size={22} />
              <span className="font-semibold text-sm">{p.coin}</span>
              <span
                className={cx(
                  "rounded px-1.5 py-0.5 font-semibold text-[11px]",
                  long ? "bg-up-wash text-up" : "bg-down-wash text-down",
                )}
              >
                {long ? "Long" : "Short"} {p.leverage}×
              </span>
              <span className={cx("ml-auto text-sm", upDown(p.unrealizedPnl))}>
                {hidden ? (
                  MASK
                ) : (
                  <RollingNumber
                    value={p.unrealizedPnl}
                    format={{ style: "currency", currency: "USD", signDisplay: "always" }}
                  />
                )}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <span className="flex flex-col">
                <span className="text-muted">Size</span>
                <span className="num">{hidden ? MASK : Math.abs(p.size)}</span>
              </span>
              <span className="flex flex-col">
                <span className="text-muted">Entry → mark</span>
                <span className="num">
                  {price(p.entryPx)} → {price(mark)}
                </span>
              </span>
              <span className="flex flex-col">
                <span className="text-muted">Liquidation</span>
                <span className="num text-warning">{p.liquidationPx ? price(p.liquidationPx) : "–"}</span>
              </span>
            </div>
            {perp ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void run("Closing at market", async () => (await hlAccount(wallet)).close(perp, p, mark))
                }
                className="h-8 rounded-full border border-strong text-[13px] hover:bg-surface-3 disabled:opacity-40"
              >
                Close position
              </button>
            ) : null}
          </div>
        );
      })}
      {s?.orders.map((o) => {
        const perp = perpOf(o.coin);
        return (
          <div key={o.oid} className="flex items-center justify-between gap-2 text-[12px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <Mark symbol={o.coin} size={16} />
              {o.trigger
                ? `${o.trigger.kind} at ${price(o.trigger.px)}`
                : `${o.isBuy ? "Buy" : "Sell"} ${o.size} at ${price(o.px)}`}
            </span>
            {perp ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("Cancelling", async () => (await hlAccount(wallet)).cancel(perp, o.oid))}
                className="text-accent hover:underline disabled:opacity-40"
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
          onClick={() => void run("Gathering USDC and swapping home", () => sendHyperliquidHome(wallet.id))}
          className="h-9 rounded-full bg-accent font-semibold text-[13px] text-accent-ink hover:brightness-110 disabled:opacity-40"
        >
          Send the money home
        </button>
      ) : null}
      {busy ? <Wait verb={busy} /> : null}
      {error ? <p className="text-[12px] text-down">{error}</p> : null}
    </li>
  );
}

/** Every live Hyperliquid private wallet with what it holds. */
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
    return (
      <EmptyState
        icon={Layers}
        title="No positions yet"
        body="Each position opens from its own brand-new wallet, so nobody can follow one trade to the next."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {wallets.map((w) => (
        <WalletPositions key={w.id} wallet={w} perps={perps} mids={mids} />
      ))}
    </ul>
  );
}
