"use client";

import type { LiveStatus } from "@mitoshi/venues/hyperliquid";
import { SOL_MINT } from "@mitoshi/venues/solana";
import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";
import { cx, LiveDot } from "@/kit";
import { hlLive, hlMarket } from "../hyperliquid/hl";
import { pmMarket } from "../polymarket/pm";
import { oneclick } from "../private-wallets/swaps";
import { solMarket } from "../solana/sol";
import { useWallet } from "../wallet/wallet-store";

const PROBE_STALE_MS = 30_000;
const MS_PER_SECOND = 1000;
const SLOW_MS = 2_500;

interface Probe {
  id: string;
  name: string;
  /** What this party can see of you. */
  sees: string;
  run: () => Promise<unknown>;
}

/** One cheap public request per party, timed. Each goes the same private way every request does. */
const PROBES: Probe[] = [
  {
    id: "gateway",
    name: "Mitoshi gateway · Ireland",
    sees: "What is asked, never who asks (OHTTP: it gets no IP and no cookies)",
    run: () => hlMarket.mids(),
  },
  {
    id: "near",
    name: "NEAR Intents · 1Click",
    sees: "Each swap: a standard ZEC amount in, a fresh wallet out",
    run: () => oneclick.tokens(),
  },
  {
    id: "jupiter",
    name: "Jupiter · Solana",
    sees: "A fresh Solana wallet's swaps, from the gateway's address",
    run: () => solMarket.prices([SOL_MINT]),
  },
  {
    id: "polymarket",
    name: "Polymarket",
    sees: "Market reads from the gateway's address",
    run: () => pmMarket.events("trending"),
  },
];

function Row({
  name,
  sees,
  ok,
  detail,
  onRetry,
}: {
  name: string;
  sees: string;
  ok: boolean | null;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <li className="flex items-center gap-3 border-hairline border-b px-3 py-3 text-[13px] last:border-b-0">
      <LiveDot tone={ok === null ? "muted" : ok ? "up" : "accent"} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{name}</span>
        <span className="text-[12px] text-muted">{sees}</span>
      </span>
      <span className={cx("num text-right text-[12px]", ok === false ? "text-down" : "text-ink-2")}>{detail}</span>
      {onRetry ? (
        <button
          type="button"
          aria-label={`Check ${name} again`}
          onClick={onRetry}
          className="p-1 text-muted hover:text-ink"
        >
          <RotateCw size={13} />
        </button>
      ) : null}
    </li>
  );
}

function ProbeRow({ p }: { p: Probe }) {
  const q = useQuery({
    queryKey: ["status", p.id],
    staleTime: PROBE_STALE_MS,
    retry: false,
    queryFn: async () => {
      const t = performance.now();
      await p.run();
      return Math.round(performance.now() - t);
    },
  });
  const ms = q.data;
  return (
    <Row
      name={p.name}
      sees={p.sees}
      ok={q.isPending ? null : !q.isError}
      detail={
        q.isPending || q.isFetching
          ? "checking…"
          : q.isError
            ? "not answering"
            : `${ms} ms${(ms ?? 0) > SLOW_MS ? " · slow" : ""}`
      }
      onRetry={() => void q.refetch()}
    />
  );
}

/** Status: every party between this browser and the venues, checked live, with what each one can see. */
export function Status() {
  const w = useWallet();
  const [feed, setFeed] = useState<LiveStatus>("connecting");
  useEffect(() => hlLive().onStatus(setFeed), []);
  const synced = w.syncedAt ? Math.round((Date.now() - w.syncedAt) / MS_PER_SECOND) : null;
  return (
    <section id="status" className="flex scroll-mt-24 flex-col gap-3">
      <h2 className="type-title">Status</h2>
      <ul className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
        <Row
          name="Your browser"
          sees="Everything: your keys, balances and the map of your wallets, encrypted on this device"
          ok
          detail="this device"
        />
        <Row
          name="Mitoshi relay · Cloudflare"
          sees="Your IP address, never what you ask (every request is sealed for the gateway)"
          ok={feed === "live" ? true : feed === "connecting" ? null : false}
          detail={feed === "live" ? "live" : feed}
        />
        {PROBES.map((p) => (
          <ProbeRow key={p.id} p={p} />
        ))}
        <Row
          name="Zcash light server"
          sees="Requests for blocks from the gateway; your shielded notes are decrypted only here"
          ok={w.syncError ? false : w.summary?.tip ? true : null}
          detail={
            w.syncError
              ? "not answering"
              : w.summary?.tip
                ? `block ${w.summary.tip.toLocaleString()}${synced !== null ? ` · ${synced}s ago` : ""}`
                : "starting"
          }
        />
      </ul>
    </section>
  );
}
