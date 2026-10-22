"use client";

import { type HistoryEntry, type Summary, ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { useState } from "react";
import { renderSVG } from "uqr";
import { ZEC_NETWORK } from "@/constants";
import { freshAddress, previewSend, send, type WalletState } from "./wallet-store";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DECIMALS = 8;

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DECIMALS).replace(/\.?0+$/, "");

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;

function inWords(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MS_PER_MINUTE));
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function Balance({ summary, restingUntil }: { summary: Summary | null; restingUntil: number | null }) {
  const b = summary?.balance;
  const spendable = b ? b.ironwood.spendable + b.orchard.spendable : 0;
  const resting = b ? b.ironwood.locked + b.orchard.locked : 0;
  const pending = b ? b.total - spendable - resting : 0;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 p-5">
      <p className="text-sm opacity-60">Private balance</p>
      <p className="font-mono font-semibold text-3xl">
        {zec(spendable)} {UNIT}
      </p>
      {pending > 0 ? (
        <p className="text-sm opacity-60">
          + {zec(pending)} {UNIT} confirming
        </p>
      ) : null}
      {resting > 0 ? (
        <p className="text-sm opacity-60">
          + {zec(resting)} {UNIT} resting
          {restingUntil ? `, usable in about ${inWords(restingUntil - Date.now())}` : ""} (it came from a public
          address, so it waits a few hours before it can fund anything)
        </p>
      ) : null}
    </div>
  );
}

const SECONDS_TO_MS = 1000;

function History({ entries, tip }: { entries: HistoryEntry[]; tip: number | null }) {
  if (entries.length === 0) {
    return <p className="text-sm opacity-60">No transactions yet. Deposit from a shielded wallet to begin.</p>;
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/10 p-5">
      <h3 className="font-medium">History</h3>
      <ul className="flex flex-col divide-y divide-white/5">
        {entries.map((e) => {
          const state = e.expired
            ? "expired"
            : e.minedHeight === null
              ? "confirming"
              : tip !== null
                ? `${(tip - e.minedHeight + 1).toLocaleString()} confirmations`
                : "confirmed";
          const kind = e.internal ? "Moved between pools" : e.delta >= 0 ? "Received" : "Sent";
          return (
            <li key={e.txid} className="flex items-baseline justify-between gap-3 py-2 text-sm">
              <span className="flex flex-col">
                <span>
                  {kind}
                  {e.fromPublic ? <span className="ml-2 text-xs opacity-60">from a public address</span> : null}
                </span>
                <span className="text-xs opacity-50">
                  {e.time ? new Date(e.time * SECONDS_TO_MS).toLocaleString() : "pending"} · {state}
                </span>
              </span>
              <span className="font-mono">
                {e.delta >= 0 ? "+" : "−"}
                {zec(Math.abs(e.delta))} {UNIT}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SyncLine({ state }: { state: WalletState }) {
  const p = state.progress;
  if (state.phase === "syncing" || p) {
    const left = p ? `${p.remainingBlocks.toLocaleString()} blocks left` : "starting";
    return <p className="text-sm opacity-60">Syncing privately… {left}</p>;
  }
  const tip = state.summary?.tip;
  return tip ? <p className="text-sm opacity-60">Up to date at block {tip.toLocaleString()}</p> : null;
}

function Deposit() {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-5">
      <h3 className="font-medium">Deposit</h3>
      {address ? (
        <>
          <img
            className="w-48 rounded bg-white p-2"
            alt="Deposit address QR code"
            src={`data:image/svg+xml,${encodeURIComponent(renderSVG(address))}`}
          />
          <p className="break-all font-mono text-xs">{address}</p>
          <button
            type="button"
            className="self-start text-sm underline"
            onClick={() => void navigator.clipboard.writeText(address)}
          >
            Copy address
          </button>
          <p className="text-sm opacity-60">A fresh address every time. Send from a shielded wallet (like Zodl).</p>
        </>
      ) : (
        <button
          type="button"
          className="self-start rounded-lg border border-white/20 px-4 py-2"
          onClick={() => freshAddress().then(setAddress, (e: unknown) => setError(String(e)))}
        >
          Show a deposit address
        </button>
      )}
      {error ? <p className="text-red-400 text-sm">{error}</p> : null}
    </div>
  );
}

type SendStep =
  | { kind: "form" }
  | { kind: "preview"; fee: number }
  | { kind: "sending" }
  | { kind: "sent"; txid: string }
  | { kind: "failed"; error: string };

function Send() {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<SendStep>({ kind: "form" });
  const zat = Math.round(Number(amount) * ZAT_PER_ZEC);
  const ready = to.length > 0 && Number.isFinite(zat) && zat > 0;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 p-5">
      <h3 className="font-medium">Send</h3>
      <input
        className="rounded-lg border border-white/20 bg-transparent px-3 py-2 font-mono text-sm"
        placeholder="Shielded address"
        value={to}
        onChange={(e) => setTo(e.target.value.trim())}
        spellCheck={false}
      />
      <input
        className="rounded-lg border border-white/20 bg-transparent px-3 py-2 font-mono text-sm"
        placeholder={`Amount in ${UNIT}`}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {step.kind === "form" ? (
        <button
          type="button"
          disabled={!ready}
          className="self-start rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40"
          onClick={() =>
            previewSend(to, zat).then(
              (p) => setStep({ kind: "preview", fee: p.fee }),
              (e: unknown) => setStep({ kind: "failed", error: String(e) }),
            )
          }
        >
          Review
        </button>
      ) : null}
      {step.kind === "preview" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Network fee {zec(step.fee)} {UNIT}
          </p>
          <button
            type="button"
            className="self-start rounded-lg bg-white px-4 py-2 font-medium text-black"
            onClick={() => {
              setStep({ kind: "sending" });
              send(to, zat).then(
                (r) => setStep({ kind: "sent", txid: r.txid }),
                (e: unknown) => setStep({ kind: "failed", error: String(e) }),
              );
            }}
          >
            Send privately
          </button>
        </div>
      ) : null}
      {step.kind === "sending" ? (
        <p className="text-sm opacity-70">Making the private proof and sending… (about 20 seconds)</p>
      ) : null}
      {step.kind === "sent" ? <p className="break-all text-sm">Sent. Transaction {step.txid}</p> : null}
      {step.kind === "failed" ? <p className="text-red-400 text-sm">{step.error}</p> : null}
    </div>
  );
}

export function WalletHome({ state }: { state: WalletState }) {
  return (
    <section className="flex flex-col gap-4">
      <Balance summary={state.summary} restingUntil={state.restingUntil} />
      <SyncLine state={state} />
      <Deposit />
      <Send />
      <History entries={state.history} tip={state.summary?.tip ?? null} />
    </section>
  );
}
