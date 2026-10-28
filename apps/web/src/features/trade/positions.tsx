"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cx, EmptyState, RollingNumber, Skeleton, TxSteps, Wait } from "@/kit";
import { price, upDown } from "../format";
import { useJudgeDesk } from "../judge/judge";
import { Mark } from "../marks/mark";
import { DRIVERS, usePerpAccount } from "../perps/hooks";
import { type PerpMarket, type PerpVenue, terminalHref } from "../perps/model";
import { useNow } from "../private-wallets/use-now";
import { homeSteps } from "../private-wallets/wallet-steps";
import { MASK, useHideAmounts } from "../shell/prefs";

const ADDRESS_HEAD = 6;
const ADDRESS_TAIL = 4;

interface Props {
  venue: PerpVenue;
  wallet: PrivateWallet;
  markets: PerpMarket[];
  marks: Record<string, number>;
}

/** A trip home's steps with its countdown; only this ticks every second. */
function TripHome({ wallet }: { wallet: PrivateWallet }) {
  const now = useNow();
  return <TxSteps steps={homeSteps(wallet, now)} />;
}

function WalletPositions({ venue, wallet, markets, marks }: Props) {
  const driver = DRIVERS[venue];
  const account = usePerpAccount(venue, wallet);
  const queries = useQueryClient();
  const [hidden] = useHideAmounts();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The judges' wallet is shared: it stays on its venue for the next judge.
  const shared = useJudgeDesk() !== null;
  const marketOf = (id: string) => markets.find((m) => m.id === id);

  async function run(verb: string, job: () => Promise<unknown>) {
    setBusy(verb);
    setError(null);
    try {
      await job();
      await queries.invalidateQueries({ queryKey: ["perps", venue, "account", wallet.id] });
    } catch (e) {
      setError(`${e instanceof Error ? e.message : String(e)}. Your money is where it was.`);
    } finally {
      setBusy(null);
    }
  }

  const s = account.data;
  // On its way home, or a send that never left: the same steps, with the countdown, as on Wallets.
  const home = wallet.status === "returning" || wallet.status === "failed";
  if (account.isPending) return <Skeleton className="h-20" label="Reading the wallet" />;
  // Sending home cancels open orders itself; only open positions must be closed first.
  const closed = s !== undefined && s.positions.length === 0;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-3">
      <div className="flex items-center justify-between text-[12px] text-muted">
        <span className="font-mono">
          {wallet.address.slice(0, ADDRESS_HEAD)}…{wallet.address.slice(-ADDRESS_TAIL)}
        </span>
        <span className={cx(wallet.status === "failed" && "text-down")}>
          {wallet.status === "returning"
            ? "Coming home"
            : wallet.status === "failed"
              ? "Not sent"
              : wallet.status === "trading"
                ? "Trading"
                : "Ready"}
        </span>
      </div>
      {home ? <TripHome wallet={wallet} /> : null}
      {s?.positions.map((p) => {
        const m = marketOf(p.marketId);
        const mark = marks[p.marketId] ?? m?.markPx ?? p.entryPx;
        const long = p.size > 0;
        const pnl = (long ? mark - p.entryPx : p.entryPx - mark) * Math.abs(p.size);
        return (
          <div key={p.marketId} className="flex flex-col gap-2 rounded-lg bg-surface-2/60 p-2.5">
            <div className="flex items-center gap-2">
              <Mark symbol={m?.name ?? p.marketId} src={m?.logo ?? null} size={22} held />
              {m ? (
                <Link href={terminalHref(m)} className="font-semibold text-sm hover:underline">
                  {m.name}
                </Link>
              ) : (
                <span className="font-semibold text-sm">{p.marketId}</span>
              )}
              <span
                className={cx(
                  "rounded px-1.5 py-0.5 font-semibold text-[11px]",
                  long ? "bg-up-wash text-up" : "bg-down-wash text-down",
                )}
              >
                {long ? "Long" : "Short"} {p.leverage}×
              </span>
              <span className={cx("ml-auto text-sm", upDown(pnl))}>
                {hidden ? (
                  MASK
                ) : (
                  <RollingNumber value={pnl} format={{ style: "currency", currency: "USD", signDisplay: "always" }} />
                )}
              </span>
            </div>
            <div className="num flex justify-between text-[12px] text-ink-2">
              <span>
                {price(p.entryPx)} → {price(mark)}
              </span>
              <span className="text-warning">Liq {p.liquidationPx ? price(p.liquidationPx) : "–"}</span>
            </div>
            {m ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("Closing at market", () => driver.close(wallet, m, p, mark))}
                className="h-9 rounded-full border border-strong font-medium text-[13px] hover:bg-surface-3 disabled:opacity-40"
              >
                Close
              </button>
            ) : null}
          </div>
        );
      })}
      {s?.orders.map((o) => {
        const m = marketOf(o.marketId);
        return (
          <div key={o.oid} className="flex items-center justify-between gap-2 text-[12px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <Mark symbol={m?.name ?? o.marketId} src={m?.logo ?? null} size={16} held />
              {o.trigger
                ? `${o.trigger.kind === "tp" ? "Take profit" : "Stop loss"} ${price(o.trigger.px)}`
                : `${o.isBuy ? "Buy" : "Sell"} ${o.size} at ${price(o.px)}`}
            </span>
            {m ? (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("Cancelling", () => driver.cancel(wallet, m, o.oid))}
                className="text-accent hover:underline disabled:opacity-40"
              >
                Cancel
              </button>
            ) : null}
          </div>
        );
      })}
      {closed && wallet.status !== "returning" && !shared ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void run("Swapping home to shielded ZEC", () => driver.sendHome(wallet))}
          className="h-10 rounded-full bg-accent font-semibold text-[13px] text-accent-ink hover:brightness-110 disabled:opacity-40"
        >
          {s.orders.length ? "Cancel orders and send home" : "Send home"}
        </button>
      ) : null}
      {busy ? <Wait verb={busy} /> : null}
      {error ? <p className="text-[12px] text-down">{error}</p> : null}
    </li>
  );
}

/** Every live private wallet on a venue with what it holds. */
export function Positions({ venue, wallets, markets, marks }: Omit<Props, "wallet"> & { wallets: PrivateWallet[] }) {
  if (wallets.length === 0) {
    return <EmptyState icon={Layers} title="No positions yet" body="Each one opens from its own new wallet." />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {wallets.map((w) => (
        <WalletPositions key={w.id} venue={venue} wallet={w} markets={markets} marks={marks} />
      ))}
    </ul>
  );
}
