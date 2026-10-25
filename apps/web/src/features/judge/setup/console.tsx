"use client";

import { ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { Check, Copy, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DESK_COUNT, DESK_READY_ZAT, DESK_SHARE_ZAT, JUDGE_ORIGIN, ZEC_NETWORK } from "@/constants";
import { Button, cx, Toaster } from "@/kit";
import { FUNDING_FEE_RESERVE_ZAT, startJobs } from "../../private-wallets/jobs";
import { loadRegistry } from "../../private-wallets/registry-store";
import { STATUS } from "../../private-wallets/venues";
import { claimTab } from "../../vault/tab-lock";
import { DepositDrawer } from "../../wallet/deposit-drawer";
import { bootWallet, createWallet, money, newPhrase, sendMany, useWallet } from "../../wallet/wallet-store";
import { DESK_VERSION, type DeskIndex, newDeskKey, sealIndex, toBase64 } from "../desk";
import { setupSlot, slotWindowName } from "../slot";
import { type DeskStatus, type FromDesk, SETUP_CHANNEL } from "./protocol";

const KEY_STORE = "mitoshi:desk-setup:key";
const SEALED_STORE = "mitoshi:desk-setup:sealed";
/** What the one payment to the six desks may cost on top of their shares (ZIP 317: seven actions). */
const PAY_FEE_RESERVE_ZAT = 60_000;
const NEED_ZAT = DESK_COUNT * DESK_SHARE_ZAT + PAY_FEE_RESERVE_ZAT;
const ZEC_DIGITS = 4;
const FUND_SPACING_MS = 60_000;
/** On the developer machine, scripts/desk-receiver.mjs takes the sealed desks straight into public/desks. */
const DESK_RECEIVER = "http://127.0.0.1:3398/desks";
const DESKS = Array.from({ length: DESK_COUNT }, (_, i) => i + 1);

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS);

function deskKey(): string {
  const saved = localStorage.getItem(KEY_STORE);
  if (saved) return saved;
  const key = newDeskKey();
  localStorage.setItem(KEY_STORE, key);
  return key;
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <h2 className="flex items-center gap-2 font-semibold text-[15px]">
        <span
          className={cx(
            "flex size-6 items-center justify-center rounded-full text-[12px]",
            done ? "bg-up text-black" : "bg-surface-3 text-ink-2",
          )}
        >
          {done ? <Check size={14} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function DeskCard({ n, s, sealed }: { n: number; s: DeskStatus | undefined; sealed: boolean }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface-1 p-3 text-[12px]">
      <span className="flex items-center justify-between font-semibold text-[13px]">
        Desk {n}
        {sealed ? <span className="text-up">sealed</span> : null}
      </span>
      <span className="text-muted">{s ? s.phase : "starting…"}</span>
      <span className="num">
        {s ? `${zec(s.spendable)} spendable · ${zec(s.confirming + s.resting)} on the way` : "–"}
      </span>
      <span className={cx(s?.ready?.status === "ready" ? "text-up" : "text-ink-2")}>
        Hyperliquid: {s?.ready ? STATUS[s.ready.status].word : "none yet"}
      </span>
      {s?.ready?.error || s?.error ? <span className="text-down">{s.ready?.error ?? s.error}</span> : null}
    </li>
  );
}

/**
 * Setting up the judges' desks, on a developer machine (mainnet dev server). The page's own wallet is the treasury,
 * funded once; six frames hold the six desks. One payment from the treasury gives each desk its share, each desk funds
 * a Hyperliquid wallet the ordinary way, and then each seals itself into a desk file under one key.
 */
export function DeskConsole() {
  const dev = process.env.NODE_ENV === "development";
  const [slotSet, setSlotSet] = useState(false);
  const w = useWallet();
  const [desks, setDesks] = useState<Record<number, DeskStatus>>({});
  const [files, setFiles] = useState<Record<number, { file: string; hyperliquid: string }>>({});
  const [problems, setProblems] = useState<Record<number, string>>({});
  const [deposit, setDeposit] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);
  const [frames, setFrames] = useState(true);
  const [copied, setCopied] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [twice, setTwice] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!dev) return;
    // The page's own vault is the treasury's: named before anything opens it.
    if (setupSlot() !== "treasury") window.name = slotWindowName("treasury");
    setSlotSet(true);
    try {
      if (localStorage.getItem(SEALED_STORE)) setFrames(false);
    } catch {
      // No storage: the frames simply open.
    }
    // One console at a time: a second one would run every desk twice.
    void claimTab().then((mine) => {
      if (!mine) {
        setTwice(true);
        return;
      }
      void bootWallet();
      loadRegistry().then(startJobs, () => undefined);
    });
    const ch = new BroadcastChannel(SETUP_CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<FromDesk>) => {
      const m = e.data;
      if (m.kind === "status") setDesks((d) => ({ ...d, [m.n]: m }));
      if (m.kind === "sealed") setFiles((f) => ({ ...f, [m.n]: { file: m.file, hyperliquid: m.hyperliquid } }));
      if (m.kind === "failed") setProblems((p) => ({ ...p, [m.n]: m.error }));
    };
    return () => ch.close();
  }, [dev]);

  useEffect(() => {
    if (w.phase === "empty") void createWallet(newPhrase(), false);
  }, [w.phase]);

  const treasury = money(w.summary?.balance);
  const addresses = DESKS.map((n) => desks[n]?.address ?? null);
  const paid = DESKS.every((n) => (desks[n]?.spendable ?? 0) + (desks[n]?.confirming ?? 0) >= DESK_SHARE_ZAT);
  const funded = DESKS.filter((n) => desks[n]?.ready?.status === "ready").length;
  const sealed = Object.keys(files).length;
  const link = useMemo(() => (slotSet ? `${JUDGE_ORIGIN}/#k=${deskKey()}` : ""), [slotSet]);

  if (!dev) {
    return <p className="p-8 text-center text-muted">Desk setup runs on a developer machine.</p>;
  }
  if (twice) {
    return <p className="p-8 text-center text-muted">Desk setup is open in another tab. Use that one.</p>;
  }

  const pay = async () => {
    const payments = addresses.map((to) => ({ to: to as string, zat: DESK_SHARE_ZAT }));
    setPaying("Proving and sending…");
    try {
      const { txid } = await sendMany(payments);
      setPaying(`Sent ${txid.slice(0, 10)}…`);
    } catch (e) {
      setPaying(e instanceof Error ? e.message : String(e));
    }
  };

  // A minute apart, so six desks never prove at once on one machine (a starved proof can outlive NEAR's quote).
  const fundAll = () => {
    for (const n of DESKS) {
      setTimeout(() => channel.current?.postMessage({ kind: "fund", n }), (n - 1) * FUND_SPACING_MS);
    }
  };

  const sealAll = () => {
    setProblems({});
    for (const n of DESKS) channel.current?.postMessage({ kind: "seal", n, key: deskKey() });
  };

  const download = async () => {
    const index: DeskIndex = {
      v: DESK_VERSION,
      network: ZEC_NETWORK,
      desks: DESKS.map((n) => ({ n, hyperliquid: files[n]?.hyperliquid ?? "" })),
    };
    const out = {
      index: toBase64(await sealIndex(deskKey(), index)),
      desks: Object.fromEntries(DESKS.map((n) => [n, files[n]?.file])),
    };
    const text = JSON.stringify(out);
    const saved = await fetch(DESK_RECEIVER, { method: "POST", body: text }).then(
      (r) => r.ok,
      () => false,
    );
    setPublished(saved ? "Saved to public/desks on this machine" : "No receiver running: downloaded instead");
    if (!saved) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      a.download = "mitoshi-desks.json";
      a.click();
    }
    localStorage.setItem(SEALED_STORE, new Date().toISOString());
    // The desks are the judges' now: this page stops running them.
    setFrames(false);
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="type-headline-md">Judge desks · setup</h1>
        <span className="type-label text-accent">{ZEC_NETWORK === "main" ? "Mainnet" : "Testnet"}</span>
      </header>

      <Step n={1} title="Fund the treasury" done={treasury.spendable >= NEED_ZAT || paid}>
        <p className="num text-[13px] text-ink-2">
          Treasury {zec(treasury.spendable)} spendable · {zec(treasury.confirming + treasury.resting)} on the way ·
          needs {zec(NEED_ZAT)} ZEC ({DESK_COUNT} × {zec(DESK_SHARE_ZAT)} and the fee)
        </p>
        <Button onClick={() => setDeposit(true)} disabled={w.phase !== "ready"}>
          Deposit to the treasury
        </Button>
      </Step>

      <Step n={2} title="Pay the six desks" done={paid}>
        <p className="text-[13px] text-ink-2">
          One shielded transaction: {DESK_COUNT} × {zec(DESK_SHARE_ZAT)} ZEC. Each desk can spend it after 10 blocks.
        </p>
        <Button
          tone="primary"
          onClick={() => void pay()}
          disabled={paid || paying !== null || treasury.spendable < NEED_ZAT || addresses.some((a) => a === null)}
        >
          Pay the desks
        </Button>
        {paying ? <p className="num text-[12px] text-muted">{paying}</p> : null}
      </Step>

      <Step n={3} title="Fund each desk's Hyperliquid wallet" done={funded === DESK_COUNT}>
        <p className="text-[13px] text-ink-2">
          {zec(DESK_READY_ZAT)} ZEC each through NEAR Intents, at a random moment: about 8 minutes. {funded} of{" "}
          {DESK_COUNT} ready.
        </p>
        <Button
          tone="primary"
          onClick={fundAll}
          disabled={DESKS.some((n) => (desks[n]?.spendable ?? 0) < DESK_READY_ZAT + FUNDING_FEE_RESERVE_ZAT)}
        >
          Fund the Hyperliquid wallets
        </Button>
      </Step>

      <Step n={4} title="Seal the desks" done={sealed === DESK_COUNT}>
        <div className="flex flex-wrap gap-2">
          <Button onClick={sealAll} disabled={funded < DESK_COUNT && ZEC_NETWORK === "main"}>
            Seal {DESK_COUNT} desks
          </Button>
          <Button onClick={() => void download()} disabled={sealed < DESK_COUNT}>
            <Download size={16} /> Save the desk files
          </Button>
        </div>
        {published ? <p className="text-[12px] text-ink-2">{published}</p> : null}
        {Object.entries(problems).map(([n, why]) => (
          <p key={n} className="text-[12px] text-down">
            Desk {n}: {why}
          </p>
        ))}
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2">
          <span className="num min-w-0 flex-1 truncate text-[12px]">{link}</span>
          <button
            type="button"
            aria-label="Copy the judges' link"
            onClick={() => void navigator.clipboard.writeText(link).then(() => setCopied(true))}
            className="rounded p-1 hover:bg-surface-3"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <p className="text-[12px] text-muted">The judges' link. It goes only into the sealed submission.</p>
      </Step>

      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {DESKS.map((n) => (
          <DeskCard key={n} n={n} s={desks[n]} sealed={files[n] !== undefined} />
        ))}
      </ul>

      {frames && !twice ? (
        <div aria-hidden className="grid grid-cols-6 gap-1 opacity-60">
          {DESKS.map((n) => (
            <iframe
              key={n}
              title={`Desk ${n}`}
              name={slotWindowName(`desk-${n}`)}
              src="/desk-setup/frame"
              className="h-8 w-full rounded border border-hairline"
            />
          ))}
        </div>
      ) : (
        <Button onClick={() => setFrames(true)}>Run the desks again</Button>
      )}

      <DepositDrawer open={deposit} onClose={() => setDeposit(false)} />
      <Toaster />
    </main>
  );
}
