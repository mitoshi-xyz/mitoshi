"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { JUDGE_ORIGIN } from "@/constants";
import { type StepState, TxSteps } from "@/kit";
import { Seal } from "../shell/seal";
import { openDesk, openIndex, parseDeskKey } from "./desk";
import { Hanko } from "./hanko";
import { holdsWallet, importDesk, leaveDesk, onJudgeHost } from "./judge";
import "@/styles/landing.css";
import "@/styles/judge.css";

const STEP_LABELS = ["Unlocking the judge wallet", "Opening it in this browser", "Ready"] as const;
const TRADE_HREF = "/trade#BTC";

type Phase =
  | { kind: "boot" }
  | { kind: "ask"; error?: string }
  | { kind: "elsewhere" }
  | { kind: "returning" }
  | { kind: "opening"; step: number; error?: string }
  | { kind: "ready" };

function stepStates(step: number, failed: boolean): StepState[] {
  return STEP_LABELS.map((_, i) => (i < step ? "done" : i === step ? (failed ? "failed" : "active") : "pending"));
}

/**
 * judge.mitoshi.xyz: opens the judges' wallet with the key from the judges' link. The key stays in this browser (it
 * sits after the #, which is never sent); the wallet list is opened with it and the wallet's records are written into
 * this origin's vault. Then the app opens on it, synced, with a Hyperliquid wallet ready to trade. Every judge shares
 * the one wallet.
 */
export function JudgeGate() {
  const [phase, setPhase] = useState<Phase>({ kind: "boot" });
  const [typed, setTyped] = useState("");
  // The gate starts once: the key leaves the address bar on the first pass, so a second pass would find none.
  const started = useRef(false);

  const run = async (key: string) => {
    let step = 0;
    try {
      setPhase({ kind: "opening", step });
      const desk = (await openIndex(key)).desks[0];
      if (!desk) throw new Error("The judge wallet is being funded: try again soon");
      step = 1;
      setPhase({ kind: "opening", step });
      await importDesk(await openDesk(key, desk.n));
      setPhase({ kind: "ready" });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setPhase(step === 0 ? { kind: "ask", error } : { kind: "opening", step, error });
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = parseDeskKey(window.location.hash);
    if (!onJudgeHost()) {
      // On mitoshi.xyz: the judge wallet opens on its own origin, key and all.
      if (key) window.location.replace(`${JUDGE_ORIGIN}/#k=${key}`);
      else setPhase({ kind: "elsewhere" });
      return;
    }
    // The key leaves the address bar at once: nothing to copy by accident, nothing in a screenshot.
    if (key) history.replaceState(null, "", window.location.pathname);
    void holdsWallet().then((held) => {
      if (held) setPhase({ kind: "returning" });
      else if (key) void run(key);
      else setPhase({ kind: "ask" });
    });
  }, []);

  const opening = phase.kind === "opening";
  const open = phase.kind === "ready" || phase.kind === "returning";
  const title = open ? "Ready to trade." : opening ? "Opening the judge wallet" : "Judge wallet";

  return (
    <main className="lp relative flex min-h-dvh flex-col">
      <div className="lp-ground" aria-hidden />
      <div className="lp-glow" aria-hidden />
      <div className="lp-grain" aria-hidden />
      <header className="lp-wrap relative flex items-center gap-2.5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Seal size={32} />
        <span className="font-extrabold font-heading text-[17px] tracking-[0.02em]">MITOSHI</span>
        <span className="font-stamp text-[13px] text-[var(--lp-ink-3)]">見通し</span>
        <span className="ml-auto text-[13px] text-[var(--lp-ink-3)]">ZECATHON judges</span>
      </header>

      <section className="lp-wrap relative flex flex-1 flex-col justify-center gap-7 py-10">
        <div className="flex max-w-[40rem] flex-col gap-4">
          {open ? <Hanko size={64} press /> : null}
          <span className="lp-kicker">Zcash mainnet · real money</span>
          <h1 className="lp-h1 text-[clamp(34px,6vw,60px)]">{title}</h1>
          <p className="lp-line max-w-[34rem]">
            {open
              ? "A Hyperliquid wallet funded from shielded ZEC. Every judge shares it, so you may see their trades."
              : "Judging Mitoshi? Click the Working demo link in our ZECATHON submission: it opens a wallet with real money in it. Nothing to set up."}
          </p>
        </div>

        <div className="flex max-w-[40rem] flex-col gap-6">
          {opening ? (
            <div className="lp-card p-5">
              <TxSteps
                steps={STEP_LABELS.map((label, i) => {
                  const states = stepStates(phase.step, phase.error !== undefined);
                  return {
                    label,
                    state: states[i] ?? "pending",
                    ...(i === phase.step && phase.error ? { detail: phase.error } : {}),
                  };
                })}
              />
              {phase.error ? (
                <button
                  type="button"
                  className="lp-btn lp-btn-glass lp-btn-sm mt-4"
                  onClick={() => window.location.reload()}
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          {open ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <a href={TRADE_HREF} className="lp-btn lp-btn-accent">
                  Trade BTC now <ArrowRight size={18} />
                </a>
                <a href="/portfolio" className="lp-btn lp-btn-glass">
                  Your wallet
                </a>
              </div>
              {phase.kind === "returning" ? (
                <button
                  type="button"
                  onClick={() => void leaveDesk()}
                  className="self-start text-[13px] text-[var(--lp-ink-3)] underline-offset-2 hover:text-[var(--lp-ink)] hover:underline"
                >
                  Give this wallet back
                </button>
              ) : null}
            </div>
          ) : null}

          {phase.kind === "ask" || phase.kind === "elsewhere" ? (
            <div className="flex flex-col gap-3">
              {phase.kind === "ask" ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const key = parseDeskKey(typed);
                    if (key) void run(key);
                    else setPhase({ kind: "ask", error: "That isn't a judge link" });
                  }}
                >
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="Or paste that link here"
                    aria-label="Your judge link"
                    autoComplete="off"
                    spellCheck={false}
                    className="num h-[52px] w-full min-w-0 shrink-0 rounded-full sm:w-auto sm:flex-1 bg-[var(--lp-card-2)] px-5 text-[14px] shadow-[inset_0_0_0_1px_var(--lp-line)] outline-none focus:shadow-[inset_0_0_0_1px_#e04d26]"
                  />
                  <button type="submit" className="lp-btn lp-btn-accent">
                    Open my wallet
                  </button>
                </form>
              ) : (
                <a href={JUDGE_ORIGIN} className="lp-btn lp-btn-accent self-start">
                  Open the judge wallet <ArrowRight size={18} />
                </a>
              )}
              {phase.kind === "ask" && phase.error ? (
                <p className="text-[13px] text-[var(--down)]">{phase.error}</p>
              ) : null}
              <p className="text-[13px] text-[var(--lp-ink-3)]">
                No link to hand?{" "}
                <Link href="https://mitoshi.xyz/markets" className="underline underline-offset-2">
                  Look around without one
                </Link>
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <footer className="lp-wrap relative pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[13px] text-[var(--lp-ink-3)]">
        Not judging? Mitoshi runs at{" "}
        <a href="https://mitoshi.xyz" className="text-[var(--lp-ink-2)] underline underline-offset-2">
          mitoshi.xyz
        </a>{" "}
        with your own wallet.
      </footer>
    </main>
  );
}
