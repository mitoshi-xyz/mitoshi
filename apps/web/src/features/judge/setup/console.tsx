"use client";

import { ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { Check, Copy, Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DESK_COUNT, DESK_READY_ZAT, DESK_SHARE_ZAT, JUDGE_ORIGIN, ZEC_NETWORK } from "@/constants";
import { Button, cx, Toaster, type TxStep, TxSteps } from "@/kit";
import { FUNDING_FEE_RESERVE_ZAT, startJobs } from "../../private-wallets/jobs";
import { loadRegistry } from "../../private-wallets/registry-store";
import { STATUS } from "../../private-wallets/venues";
import { claimTab } from "../../vault/tab-lock";
import { AddressCard } from "../../wallet/address-card";
import { DepositDrawer } from "../../wallet/deposit-drawer";
import {
  bootWallet,
  createWallet,
  freshAddress,
  money,
  newPhrase,
  sendMany,
  useWallet,
  vaultRecord,
} from "../../wallet/wallet-store";
import { DESK_VERSION, type DeskIndex, newDeskKey, sealIndex, toBase64 } from "../desk";
import { setupSlot, slotWindowName } from "../slot";
import { type DeskStatus, type FromDesk, SETUP_CHANNEL } from "./protocol";

const KEY_STORE = "mitoshi:desk-setup:key";
const SEALED_STORE = "mitoshi:desk-setup:sealed";
const AUTO_STORE = "mitoshi:desk-setup:auto";
const ADDRESS_STORE = "mitoshi:desk-setup:treasury-address";
/** What the payment to the judges' wallet may cost on top of its share (ZIP 317: two actions, with room to spare). */
const PAY_FEE_RESERVE_ZAT = 20_000;
const NEED_ZAT = DESK_COUNT * DESK_SHARE_ZAT + PAY_FEE_RESERVE_ZAT;
const ZEC_DIGITS = 4;
const FUND_SPACING_MS = 60_000;
/**
 * On the developer machine, scripts/desk-receiver.mjs takes the sealed desks straight into public/desks, and keeps a
 * copy of every wallet's words (the money is recoverable even if this browser's storage goes).
 */
const DESK_RECEIVER = "http://127.0.0.1:3398/desks";
const WORDS_RECEIVER = "http://127.0.0.1:3398/words";
const WORDS_WAIT_MS = 4_000;
const DESKS = Array.from({ length: DESK_COUNT }, (_, i) => i + 1);

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS);

function deskKey(): string {
  const saved = localStorage.getItem(KEY_STORE);
  if (saved) return saved;
  const key = newDeskKey();
  localStorage.setItem(KEY_STORE, key);
  return key;
}

function DeskCard({ n, s, sealed }: { n: number; s: DeskStatus | undefined; sealed: boolean }) {
  const hl = s?.ready?.status;
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-hairline bg-surface-1 p-3 text-[12px]">
      <span className="flex items-center justify-between font-semibold text-[13px]">
        Judge wallet {n}
        {sealed ? <span className="text-up">handed over</span> : null}
      </span>
      <span className="num text-ink-2">
        {s
          ? `${zec(s.spendable + s.confirming + s.resting)} ZEC${s.confirming > 0 ? " · confirming" : ""}`
          : "starting…"}
      </span>
      <span className={cx(hl === "ready" ? "text-up" : "text-muted")}>
        {hl ? `Hyperliquid: ${STATUS[hl].word}` : "Hyperliquid: not yet"}
      </span>
      {s?.ready?.error || s?.error ? <span className="text-down">{s.ready?.error ?? s.error}</span> : null}
    </li>
  );
}

/**
 * Setting up the judges' wallet, on a developer machine (the mainnet dev server). The page's own wallet is the
 * treasury; a frame holds the judges' wallet in a vault of its own. The owner does two things: sends ZEC to the
 * treasury and presses Start. From there the page runs the rest as each step's money arrives: one shielded payment
 * fills the judges' wallet, it funds a Hyperliquid wallet the ordinary way, and it locks itself under the judges' link
 * and is saved for the site.
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
  const [publishing, setPublishing] = useState(false);
  const [auto, setAuto] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const words = useRef<Record<number, string>>({});
  const [backedUp, setBackedUp] = useState<string | null>(null);

  useEffect(() => {
    if (!dev) return;
    // The page's own vault is the treasury's: named before anything opens it.
    if (setupSlot() !== "treasury") window.name = slotWindowName("treasury");
    setSlotSet(true);
    try {
      if (localStorage.getItem(SEALED_STORE)) setFrames(false);
      setAuto(localStorage.getItem(AUTO_STORE) === "1");
    } catch {
      // No storage: the frames simply open, and Start has to be pressed again.
    }
    // One console at a time: a second one would run every wallet twice.
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
      if (m.kind === "words") words.current[m.n] = m.mnemonic;
      if (m.kind === "status") setDesks((d) => ({ ...d, [m.n]: m }));
      if (m.kind === "sealed") setFiles((f) => ({ ...f, [m.n]: { file: m.file, hyperliquid: m.hyperliquid } }));
      if (m.kind === "failed") setProblems((p) => ({ ...p, [m.n]: m.error }));
    };
    return () => ch.close();
  }, [dev]);

  useEffect(() => {
    if (w.phase === "empty") void createWallet(newPhrase(), false);
    // One treasury address for good: the one the owner was given stays the one shown.
    if (w.phase === "ready" && address === null) {
      const saved = localStorage.getItem(ADDRESS_STORE);
      if (saved) setAddress(saved);
      else
        freshAddress().then(
          (a) => {
            localStorage.setItem(ADDRESS_STORE, a);
            setAddress(a);
          },
          () => undefined,
        );
    }
  }, [w.phase, address]);

  const treasury = money(w.summary?.balance);
  const addresses = DESKS.map((n) => desks[n]?.address ?? null);
  const paid = DESKS.every((n) => (desks[n]?.spendable ?? 0) + (desks[n]?.confirming ?? 0) >= DESK_SHARE_ZAT);
  const funded = DESKS.filter((n) => desks[n]?.ready?.status === "ready").length;
  const started = DESKS.filter((n) => desks[n]?.ready !== undefined && desks[n]?.ready !== null).length;
  const sealed = Object.keys(files).length;
  const handedOver = published?.startsWith("Saved") ?? false;
  const link = useMemo(() => (slotSet ? `${JUDGE_ORIGIN}/#k=${deskKey()}` : ""), [slotSet]);

  // Saved once every judge wallet has locked itself; one that couldn't stops the hand-over (its reason shows).
  const save = useRef<(() => Promise<void>) | null>(null);
  useEffect(() => {
    if (!publishing) return;
    if (Object.keys(problems).length > 0) setPublishing(false);
    else if (sealed === DESK_COUNT) void save.current?.().finally(() => setPublishing(false));
  }, [publishing, sealed, problems]);

  // After Start, each step runs as soon as the one before it has landed. Each runs once per page.
  const actions = useRef<{ pay: () => Promise<void>; fundAll: () => void; publish: () => void } | null>(null);
  const ran = useRef({ pay: false, fund: false, publish: false });
  const enough = treasury.spendable >= NEED_ZAT;
  const allHaveShare = DESKS.every((n) => (desks[n]?.spendable ?? 0) >= DESK_READY_ZAT + FUNDING_FEE_RESERVE_ZAT);
  const noneStarted = DESKS.every((n) => !desks[n]?.ready);
  useEffect(() => {
    const a = actions.current;
    if (!auto || !a) return;
    if (!ran.current.pay && !paid && enough && addresses.every((x) => x !== null)) {
      ran.current.pay = true;
      void a.pay();
    }
    if (!ran.current.fund && allHaveShare && noneStarted) {
      ran.current.fund = true;
      a.fundAll();
    }
    if (!ran.current.publish && funded === DESK_COUNT && !handedOver) {
      ran.current.publish = true;
      a.publish();
    }
  }, [auto, paid, enough, addresses, allHaveShare, noneStarted, funded, handedOver]);

  if (!dev) {
    return <p className="p-8 text-center text-muted">Judge wallet setup runs on a developer machine.</p>;
  }
  if (twice) {
    return <p className="p-8 text-center text-muted">Judge wallet setup is open in another tab. Use that one.</p>;
  }
  // Every wallet's words to this machine, before any money goes in: the vaults live only in this browser.
  const backUp = async () => {
    words.current = {};
    for (const n of DESKS) channel.current?.postMessage({ kind: "words", n });
    await new Promise((r) => setTimeout(r, WORDS_WAIT_MS));
    const treasury = await vaultRecord("mnemonic");
    const got = Object.keys(words.current).length;
    if (!treasury || got < DESK_COUNT) {
      setBackedUp(`Only ${got} of ${DESK_COUNT} wallets answered: try again`);
      return;
    }
    const body = JSON.stringify({
      network: ZEC_NETWORK,
      treasury: new TextDecoder().decode(treasury),
      desks: words.current,
    });
    const ok = await fetch(WORDS_RECEIVER, { method: "POST", body }).then(
      (r) => r.ok,
      () => false,
    );
    setBackedUp(ok ? "Every wallet's words are saved on this machine" : "No receiver running: nothing saved");
  };

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

  // A minute apart, so wallets never prove at once on one machine (a starved proof can outlive NEAR's quote).
  const fundAll = () => {
    for (const n of DESKS) {
      setTimeout(() => channel.current?.postMessage({ kind: "fund", n }), (n - 1) * FUND_SPACING_MS);
    }
  };

  // Each wallet locks itself under the link's key; once all answer, the files are saved for the site.
  const publish = () => {
    setProblems({});
    setFiles({});
    setPublishing(true);
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
    // The wallet is the judges' now: this page stops running it.
    setFrames(false);
  };
  save.current = download;

  actions.current = { pay, fundAll, publish };

  const start = () => {
    localStorage.setItem(AUTO_STORE, "1");
    setAuto(true);
    void backUp();
  };

  const moneyLine =
    treasury.spendable >= NEED_ZAT
      ? "Arrived"
      : treasury.confirming + treasury.resting > 0
        ? `${zec(treasury.confirming + treasury.resting)} ZEC on its way${treasury.resting > 0 ? ", resting 2–6 h" : ", 10 blocks"}`
        : treasury.spendable > 0
          ? `${zec(treasury.spendable)} of ${zec(NEED_ZAT)} ZEC here: send ${zec(NEED_ZAT - treasury.spendable)} more`
          : `Waiting for ${zec(NEED_ZAT)} ZEC`;
  const progress: TxStep[] = [
    { label: "Your ZEC arrives", state: paid || enough ? "done" : "active", detail: paid ? "Arrived" : moneyLine },
    {
      label: "Filling the judge wallet",
      state: paid
        ? "done"
        : paying && !paying.startsWith("Sent") && !paying.startsWith("Proving")
          ? "failed"
          : enough
            ? "active"
            : "pending",
      detail: paid ? "One shielded payment, 10 blocks" : (paying ?? undefined),
    },
    {
      label: "Getting it ready to trade",
      state: funded === DESK_COUNT ? "done" : started > 0 || allHaveShare ? "active" : "pending",
      detail: funded === DESK_COUNT ? "Ready on Hyperliquid" : "About 8 min",
    },
    {
      label: "Handing it to the judges",
      state: handedOver ? "done" : Object.keys(problems).length ? "failed" : publishing ? "active" : "pending",
      detail: published ?? (Object.keys(problems).length ? "A wallet couldn't lock itself: see its card" : undefined),
    },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-baseline justify-between">
        <h1 className="type-headline-md">Judge wallet · setup</h1>
        <span className="type-label text-accent">{ZEC_NETWORK === "main" ? "Mainnet" : "Testnet"}</span>
      </header>

      <section className="flex flex-col gap-5 rounded-xl border border-accent/40 bg-surface-1 p-5">
        <h2 className="font-semibold text-[17px]">Two things to do</h2>
        <div className="flex flex-col gap-3">
          <p className="font-medium text-[15px]">1. Send {zec(NEED_ZAT)} ZEC to this address, from Zodl</p>
          <AddressCard
            address={address}
            error={null}
            onFresh={() => setDeposit(true)}
            freshLabel="Sending from an exchange instead"
            loading="Opening the treasury"
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="font-medium text-[15px]">2. Press Start</p>
          {auto ? (
            <p className="text-[14px] text-up">Started. Leave this tab open: it does the rest.</p>
          ) : (
            <Button tone="primary" size="lg" onClick={start} disabled={w.phase !== "ready"} className="self-start">
              Start
            </Button>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
        <TxSteps steps={progress} />
        {handedOver ? (
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
        ) : null}
        {Object.entries(problems).map(([n, why]) => (
          <p key={n} className="text-[12px] text-down">
            Judge wallet {n}: {why}
          </p>
        ))}
      </section>

      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {DESKS.map((n) => (
          <DeskCard key={n} n={n} s={desks[n]} sealed={files[n] !== undefined} />
        ))}
      </ul>

      <details className="rounded-xl border border-hairline bg-surface-1 p-4 text-[13px]">
        <summary className="cursor-pointer text-ink-2">Run a step by hand</summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void backUp()} disabled={w.phase !== "ready"}>
            Back up the words
          </Button>
          <Button
            size="sm"
            onClick={() => void pay()}
            disabled={paid || paying !== null || !enough || addresses.some((a) => a === null)}
          >
            Fill the judge wallet
          </Button>
          <Button size="sm" onClick={fundAll} disabled={!allHaveShare}>
            Get it ready to trade
          </Button>
          <Button size="sm" onClick={publish} disabled={publishing || (funded < DESK_COUNT && ZEC_NETWORK === "main")}>
            <Download size={14} /> Hand it over
          </Button>
          {frames ? null : (
            <Button size="sm" onClick={() => setFrames(true)}>
              Run the judge wallet again
            </Button>
          )}
        </div>
        {backedUp ? <p className="mt-2 text-ink-2">{backedUp}</p> : null}
      </details>

      {frames && !twice ? (
        <div aria-hidden className="grid grid-cols-6 gap-1 opacity-40">
          {DESKS.map((n) => (
            <iframe
              key={n}
              title={`Judge wallet ${n}`}
              name={slotWindowName(`desk-${n}`)}
              src="/desk-setup/frame"
              className="h-6 w-full rounded border border-hairline"
            />
          ))}
        </div>
      ) : null}

      <DepositDrawer open={deposit} onClose={() => setDeposit(false)} />
      <Toaster />
    </main>
  );
}
