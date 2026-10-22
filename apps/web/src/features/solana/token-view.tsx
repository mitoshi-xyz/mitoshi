"use client";

import { latestSwap, readyWallet } from "@mitoshi/engine";
import { LAMPORTS_PER_SOL } from "@mitoshi/venues/solana";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { compactUsd, pct, price, upDown } from "../format";
import { sendSolanaHome } from "../private-wallets/home";
import { useRegistry } from "../private-wallets/registry-store";
import { useHoldings, usePrices, useToken } from "./hooks";
import { solImage } from "./sol";
import { SwapTicket } from "./swap-ticket";
import { TokenChart } from "./token-chart";

const MS_PER_MINUTE = 60_000;
const MS_PER_SECOND = 1000;
const SOL_SHOWN_DECIMALS = 4;
const MINT_HEAD = 4;

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

/** One Solana token: chart, live price, swap ticket, and the private wallet's holdings. */
export function TokenView() {
  const mint = useHashMint();
  const token = useToken(mint);
  const prices = usePrices(mint ? [mint] : []);
  const registry = useRegistry();
  const queries = useQueryClient();
  const solWallets = registry.wallets.filter((w) => w.venue === "solana");
  const trading = solWallets.find((w) => w.status === "trading");
  const wallet = trading ?? readyWallet(registry, "solana");
  const holdings = useHoldings(wallet);
  const [home, setHome] = useState<{ busy: boolean; text: string | null }>({ busy: false, text: null });

  const pending = solWallets.find((w) => w.status === "preparing" || w.status === "funding");
  const fundSwap = pending ? latestSwap(pending, "fund") : undefined;
  const waiting = !pending
    ? "No Solana private wallet is ready. Prepare one first."
    : fundSwap
      ? `A private wallet is funding: about ${Math.max(1, Math.round((fundSwap.createdAt + fundSwap.timeEstimateSeconds * MS_PER_SECOND - Date.now()) / MS_PER_MINUTE))} min left.`
      : "A private wallet is preparing: funding starts within ~3 min.";

  if (!mint) return <p className="opacity-70">Pick a token on the Markets screen.</p>;
  if (token.isPending)
    return <div role="status" aria-label="Loading the token" className="h-96 animate-pulse rounded-xl bg-white/5" />;
  if (token.isError || !token.data) {
    return (
      <p className="text-sm opacity-70">
        {token.isError ? `Could not load this token: ${token.error.message}` : "Unknown token."}
      </p>
    );
  }
  const t = token.data;
  const live = prices.data?.[mint] ?? t.usdPrice;
  const icon = solImage(t.icon);

  async function goHome() {
    if (!wallet) return;
    setHome({ busy: true, text: "Selling to SOL and sending home…" });
    try {
      const r = await sendSolanaHome(wallet.id);
      setHome({
        busy: false,
        text: r.sent > 0 ? "On its way home: swapping to ZEC on NEAR" : "Only dust was left; the wallet is retired",
      });
      void queries.invalidateQueries({ queryKey: ["solana", "holdings", wallet.id] });
    } catch (e) {
      setHome({ busy: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-3">
          {icon ? <img src={icon} alt="" className="size-9 rounded-full" /> : null}
          <h2 className="font-semibold text-2xl">{t.symbol}</h2>
          <span className="text-sm opacity-60">{t.name}</span>
        </div>
        <span className="font-mono text-xl">{price(live)}</span>
        <span className={`font-mono text-sm ${upDown(t.change24h)}`}>{pct(t.change24h)} 24h</span>
        <span className="text-sm opacity-70">Mcap {compactUsd(t.mcap)}</span>
        <span className="text-sm opacity-70">Liquidity {compactUsd(t.liquidity)}</span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <TokenChart mint={mint} livePrice={live} />
        <SwapTicket token={t} wallet={wallet} waiting={waiting} />
      </div>
      {wallet && holdings.data ? (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-4 text-sm">
          <h3 className="font-medium">This private wallet</h3>
          <p className="opacity-70">
            {(Number(holdings.data.lamports) / LAMPORTS_PER_SOL).toFixed(SOL_SHOWN_DECIMALS)} SOL
            {holdings.data.tokens.map((h) => ` · ${h.uiAmount} of ${h.mint.slice(0, MINT_HEAD)}…`).join("")}
          </p>
          {wallet.status === "trading" || wallet.status === "ready" ? (
            <button
              type="button"
              disabled={home.busy}
              onClick={() => void goHome()}
              className="self-start rounded-lg border border-white/20 px-3 py-1 text-xs disabled:opacity-40"
            >
              Sell everything and send the money home
            </button>
          ) : null}
          {home.text ? <p className="text-xs opacity-80">{home.text}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
