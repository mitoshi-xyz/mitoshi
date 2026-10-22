"use client";

import { latestSwap, readyWallet } from "@mitoshi/engine";
import { LAMPORTS_PER_SOL } from "@mitoshi/venues/solana";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { ChangeChip, CountdownRing, EmptyState, RollingNumber, Skeleton, Wait } from "@/kit";
import { compactUsd } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { openFund } from "../private-wallets/drawers";
import { sendSolanaHome } from "../private-wallets/home";
import { useRegistry } from "../private-wallets/registry-store";
import { MASK, useHideAmounts } from "../shell/prefs";
import { useHoldings, usePrices, useToken } from "./hooks";
import { SwapTicket } from "./swap-ticket";
import { TokenChart } from "./token-chart";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60_000;
const SOL_SHOWN_DECIMALS = 4;
const PRICE_SIG = 6;
const ADDRESS_HEAD = 6;

function useHashMint(): string {
  const [mint, setMint] = useState("");
  useEffect(() => {
    const read = () => setMint(decodeURIComponent(window.location.hash.slice(1)));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return mint;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col leading-tight">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="num text-[13px]">{value}</span>
    </span>
  );
}

/** One Solana token: chart and live price, the swap ticket, and the private wallet that holds it. */
export function TokenView() {
  const mint = useHashMint();
  const token = useToken(mint);
  const prices = usePrices(mint ? [mint] : []);
  const registry = useRegistry();
  const queries = useQueryClient();
  const [hidden] = useHideAmounts();
  const sol = registry.wallets.filter((w) => w.venue === "solana");
  const trading = sol.find((w) => w.status === "trading");
  const wallet = trading ?? readyWallet(registry, "solana");
  const holdings = useHoldings(wallet);
  const pending = sol.find((w) => w.status === "preparing" || w.status === "funding");
  const fundSwap = pending ? latestSwap(pending, "fund") : undefined;
  const [home, setHome] = useState<{ busy: boolean; text: string | null }>({ busy: false, text: null });

  if (!mint)
    return <EmptyState icon={AlertCircle} title="No token chosen" action={{ label: "Open Tokens", href: "/tokens" }} />;
  if (token.isPending) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-[520px] rounded-xl" label="Loading the token" />
        <Skeleton className="h-[520px] rounded-xl" />
      </div>
    );
  }
  if (token.isError || !token.data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Could not find this token"
        body={token.isError ? token.error.message : "Jupiter does not list this mint."}
        action={{ label: "Back to Tokens", href: "/tokens" }}
      />
    );
  }
  const t = token.data;
  const live = prices.data?.[mint] ?? t.usdPrice;
  const lamports = holdings.data ? Number(holdings.data.lamports) / LAMPORTS_PER_SOL : 0;
  const held = holdings.data?.tokens.find((h) => h.mint === mint);
  const waiting = !pending
    ? "No Solana private wallet is ready yet."
    : fundSwap
      ? `Funding: about ${Math.max(1, Math.round((fundSwap.createdAt + fundSwap.timeEstimateSeconds * MS_PER_SECOND - Date.now()) / MS_PER_MINUTE))} min left.`
      : "Preparing: funding starts within ~3 min.";

  async function goHome() {
    if (!wallet) return;
    setHome({ busy: true, text: null });
    try {
      const r = await sendSolanaHome(wallet.id);
      setHome({
        busy: false,
        text: r.sent > 0 ? "On its way home: swapping to ZEC on NEAR." : "Only dust was left; the wallet is retired.",
      });
      void queries.invalidateQueries({ queryKey: ["solana", "holdings", wallet.id] });
    } catch (e) {
      setHome({ busy: false, text: `${e instanceof Error ? e.message : String(e)}. Your money is where it was.` });
    }
  }

  return (
    <div className="grid min-h-[calc(100dvh-96px)] grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-[520px] flex-col border-hairline lg:border-r">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 pt-4">
          <div className="flex items-center gap-3 rounded-full border border-hairline bg-surface-1/80 py-1.5 pr-4 pl-1.5">
            <Mark symbol={t.symbol} src={t.icon} size={34} />
            <span className="flex flex-col leading-tight">
              <span className="flex items-center gap-1 font-semibold text-sm">
                {t.symbol}
                {t.verified ? <BadgeCheck size={14} className="text-info" aria-label="Verified" /> : null}
                <span className="font-normal text-muted">{t.name}</span>
              </span>
              <RollingNumber
                value={live}
                format={{ maximumSignificantDigits: PRICE_SIG, style: "currency", currency: "USD" }}
                className="font-semibold text-[15px]"
              />
            </span>
            <ChangeChip change={t.change24h} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Market cap" value={compactUsd(t.mcap)} />
            <Stat label="Liquidity" value={compactUsd(t.liquidity)} />
            <Stat label="24h volume" value={compactUsd(t.volume24h)} />
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            <VenueMark venue="solana" size={16} /> <VenueMark venue="jupiter" size={16} /> routed by Jupiter
          </span>
        </div>
        <div className="min-h-0 flex-1">
          <TokenChart mint={mint} livePrice={live} />
        </div>
      </section>

      <aside className="flex flex-col gap-4 p-4">
        {wallet ? (
          <div className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-1 p-3">
            <span className="relative">
              <VenueMark venue="solana" size={34} />
              <ShieldCheck size={14} className="absolute -right-1 -bottom-1 rounded-full bg-bg text-up" />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[12px] text-muted">
                Private wallet · <span className="font-mono">{wallet.address.slice(0, ADDRESS_HEAD)}…</span>
              </span>
              <span className="num font-semibold text-[16px]">
                {hidden ? MASK : `${lamports.toFixed(SOL_SHOWN_DECIMALS)} SOL`}
                {held && !hidden ? (
                  <span className="font-normal text-[13px] text-ink-2">
                    {" "}
                    · {held.uiAmount} {t.symbol}
                  </span>
                ) : null}
              </span>
            </span>
          </div>
        ) : pending ? (
          <div className="flex items-center gap-3 rounded-lg border border-accent/40 bg-accent-wash p-3">
            <CountdownRing
              fraction={
                fundSwap
                  ? 1 -
                    Math.max(0, fundSwap.createdAt + fundSwap.timeEstimateSeconds * MS_PER_SECOND - Date.now()) /
                      (fundSwap.timeEstimateSeconds * MS_PER_SECOND)
                  : 0
              }
              size={32}
            />
            <span className="text-[13px]">{waiting}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => openFund("solana")}
            className="flex w-full items-center gap-3 text-left rounded-lg border border-dashed border-strong p-3 transition-colors hover:border-accent hover:bg-accent-wash"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-ink">
              <Sparkles size={17} />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-medium text-sm">Fund a Solana wallet</span>
              <span className="text-[12px] text-ink-2">Brand-new, funded in SOL from your shielded ZEC.</span>
            </span>
          </button>
        )}
        <SwapTicket token={t} wallet={wallet} waiting={waiting} />
        {wallet && (wallet.status === "trading" || wallet.status === "ready") ? (
          <button
            type="button"
            disabled={home.busy}
            onClick={() => void goHome()}
            className="h-10 rounded-full border border-strong font-medium text-[13px] hover:bg-surface-2 disabled:opacity-40"
          >
            Sell everything and send it home
          </button>
        ) : null}
        {home.busy ? <Wait verb="Selling to SOL and swapping home" /> : null}
        {home.text ? <p className="text-[13px] text-ink-2">{home.text}</p> : null}
      </aside>
    </div>
  );
}
