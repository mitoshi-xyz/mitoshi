"use client";

import { readyWallet } from "@mitoshi/engine";
import { LAMPORTS_PER_SOL } from "@mitoshi/venues/solana";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowDownRight, ArrowUpRight, BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ChangeChip, cue, cx, EmptyState, RollingNumber, Sheet, Skeleton, useMedia, usePhone, Wait } from "@/kit";
import { compactUsd } from "../format";
import { Mark, VenueMark } from "../marks/mark";
import { sendSolanaHome } from "../private-wallets/home";
import { useRegistry } from "../private-wallets/registry-store";
import { WalletChip } from "../private-wallets/wallet-chip";
import { useHideAmounts } from "../shell/prefs";
import { useHoldings, usePrices, useToken } from "./hooks";
import { SwapTicket } from "./swap-ticket";
import { TokenChart } from "./token-chart";

const SOL_SHOWN_DECIMALS = 4;
const PRICE_SIG = 6;
/** From here the ticket sits beside the chart; below it, it opens in a sheet. */
const WIDE = "(min-width: 1024px)";

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
  const [home, setHome] = useState<{ busy: boolean; text: string | null }>({ busy: false, text: null });
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [sheet, setSheet] = useState(false);
  const wide = useMedia(WIDE);
  const phone = usePhone();

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
  const chip = (className?: string) => (
    <WalletChip
      venue="solana"
      wallet={wallet}
      pending={pending}
      value={
        holdings.data
          ? `${lamports.toFixed(SOL_SHOWN_DECIMALS)} SOL${held && !hidden ? ` · ${held.uiAmount} ${t.symbol}` : ""}`
          : undefined
      }
      loading={holdings.isPending}
      {...(className ? { className } : {})}
    />
  );

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

  const ticket = (inSheet: boolean) => (
    <SwapTicket
      token={t}
      wallet={wallet}
      side={side}
      onSide={setSide}
      keypad={inSheet && phone}
      sideInHeader={inSheet}
    />
  );
  const sendHome =
    wallet && (wallet.status === "trading" || wallet.status === "ready") ? (
      <button
        type="button"
        disabled={home.busy}
        onClick={() => void goHome()}
        className="h-10 rounded-full border border-strong font-medium text-[13px] hover:bg-surface-2 disabled:opacity-40"
      >
        Sell all and send home
      </button>
    ) : null;
  const homeState = (
    <>
      {home.busy ? <Wait verb="Selling to SOL and swapping home" /> : null}
      {home.text ? <p className="text-[13px] text-ink-2">{home.text}</p> : null}
    </>
  );

  return (
    <div className="grid h-[calc(100dvh-160px)] grid-cols-[minmax(0,1fr)] md:h-[calc(100dvh-88px)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="relative flex min-h-0 flex-col lg:border-hairline lg:border-r">
        <div className="flex items-start justify-between gap-3 px-3 pt-3">
          <div className="flex min-w-0 items-center gap-2.5 rounded-full border border-hairline bg-surface-1/85 py-1.5 pr-3 pl-1.5">
            <Mark symbol={t.symbol} src={t.icon} size={34} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="flex items-center gap-1 font-semibold text-sm">
                <span className="truncate">{t.symbol}</span>
                {t.verified ? <BadgeCheck size={14} className="shrink-0 text-info" aria-label="Verified" /> : null}
              </span>
              <RollingNumber
                value={live}
                format={{ maximumSignificantDigits: PRICE_SIG, style: "currency", currency: "USD" }}
                className="font-semibold text-[15px]"
              />
            </span>
            <ChangeChip change={t.change24h} />
          </div>
          <div className="hidden flex-wrap gap-x-6 gap-y-2 pt-1.5 xl:flex">
            <Stat label="Market cap" value={compactUsd(t.mcap)} />
            <Stat label="Liquidity" value={compactUsd(t.liquidity)} />
            <Stat label="24h volume" value={compactUsd(t.volume24h)} />
          </div>
          {chip("lg:hidden")}
        </div>
        <div className="min-h-0 flex-1">
          <TokenChart mint={mint} livePrice={live} />
        </div>
        <footer className="grid grid-cols-2 gap-2.5 px-3 pt-2 pb-3 lg:hidden">
          {(["buy", "sell"] as const).map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => {
                cue("tap");
                setSide(x);
                setSheet(true);
              }}
              className={cx(
                "flex h-14 items-center justify-center gap-2 rounded-full font-extrabold text-[16px] text-bg uppercase tracking-[0.06em] active:scale-[0.98]",
                x === "buy" ? "bg-up" : "bg-down",
              )}
            >
              {x === "buy" ? <ArrowUpRight size={20} strokeWidth={3} /> : <ArrowDownRight size={20} strokeWidth={3} />}
              {x}
            </button>
          ))}
        </footer>
      </section>

      <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto p-4 lg:flex">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <VenueMark venue="solana" size={16} /> <VenueMark venue="jupiter" size={16} /> Jupiter
          </span>
          {chip()}
        </div>
        {wide ? ticket(false) : null}
        {sendHome}
        {homeState}
      </aside>

      <Sheet
        open={sheet && !wide}
        onClose={() => setSheet(false)}
        title={
          <span className="flex items-center gap-1 rounded-full bg-surface-2 p-0.5 text-[14px]">
            {(["buy", "sell"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setSide(x)}
                className={cx(
                  "h-8 rounded-full px-4 font-semibold capitalize",
                  side === x ? (x === "buy" ? "bg-up text-bg" : "bg-down text-bg") : "text-ink-2",
                )}
              >
                {x} {t.symbol}
              </button>
            ))}
          </span>
        }
      >
        {wide ? null : ticket(true)}
        {sendHome}
        {homeState}
      </Sheet>
    </div>
  );
}
