"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DESK_COUNT, JUDGE_ORIGIN } from "@/constants";
import { type StepState, TxSteps } from "@/kit";
import { Seal } from "../shell/seal";
import { openDesk, openIndex, parseDeskKey } from "./desk";
import { Hanko } from "./hanko";
import { type DeskCheck, holdsWallet, importDesk, judgeDesk, leaveDesk, onJudgeHost, pickDesk } from "./judge";
import "@/styles/landing.css";
import "@/styles/judge.css";

const DESKS = Array.from({ length: DESK_COUNT }, (_, i) => i + 1);
const STEP_LABELS = ["Unlocking the desks", "Finding a free desk", "Opening the desk", "Ready"] as const;
const TRADE_HREF = "/trade#BTC";
const pad = (n: number) => String(n).padStart(2, "0");

type Phase =
  | { kind: "boot" }
  | { kind: "ask"; error?: string }
  | { kind: "elsewhere" }
  | { kind: "returning"; n: number | null }
  | { kind: "opening"; step: number; n?: number; error?: string }
  | { kind: "ready"; n: number; shared: boolean };

function Desks({ checks, mine }: { checks: Record<number, DeskCheck>; mine?: number | undefined }) {
  return (
    <ol className="jd-desks" aria-label="The six desks">
      {DESKS.map((n) => {
        const state = mine === n ? "yours" : checks[n];
        return (
          <li key={n} className="jd-desk" data-state={state ?? "idle"}>
            {state === "yours" ? <Hanko size={30} press /> : pad(n)}
            <small>
              {state === "yours" ? "Yours" : state === "used" ? "Taken" : state === "free" ? "Free" : "Desk"}
            </small>
          </li>
        );
      })}
    </ol>
  );
}

function stepStates(step: number, failed: boolean): StepState[] {
  return STEP_LABELS.map((_, i) => (i < step ? "done" : i === step ? (failed ? "failed" : "active") : "pending"));
}

/**
 * judge.mitoshi.xyz: opens one of the six desks with the key from the judges' link. The key stays in this browser (it
 * sits after the #, which is never sent); the desk list is opened with it, a free desk is found from public data, and
 * its records are written into this origin's vault. Then the app opens on that desk, synced, with a Hyperliquid
 * wallet ready to trade.
 */
export function JudgeGate() {
  const [phase, setPhase] = useState<Phase>({ kind: "boot" });
  const [checks, setChecks] = useState<Record<number, DeskCheck>>({});
  const [typed, setTyped] = useState("");
  // The gate starts once: the key leaves the address bar on the first pass, so a second pass would find none.
  const started = useRef(false);

  const run = async (key: string) => {
    setChecks({});
    let step = 0;
    let picked: number | undefined;
    try {
      setPhase({ kind: "opening", step });
      const index = await openIndex(key);
      step = 1;
      setPhase({ kind: "opening", step });
      const pick = await pickDesk(index, (n, s) => setChecks((c) => ({ ...c, [n]: s })));
      picked = pick.n;
      step = 2;
      setPhase({ kind: "opening", step, n: pick.n });
      await importDesk(await openDesk(key, pick.n));
      setPhase({ kind: "ready", n: pick.n, shared: pick.shared });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if (step === 0) setPhase({ kind: "ask", error });
      else setPhase({ kind: "opening", step, ...(picked ? { n: picked } : {}), error });
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const key = parseDeskKey(window.location.hash);
    if (!onJudgeHost()) {
      // On mitoshi.xyz: the desks open on their own origin, key and all.
      if (key) window.location.replace(`${JUDGE_ORIGIN}/#k=${key}`);
      else setPhase({ kind: "elsewhere" });
      return;
    }
    // The key leaves the address bar at once: nothing to copy by accident, nothing in a screenshot.
    if (key) history.replaceState(null, "", window.location.pathname);
    void holdsWallet().then((held) => {
      if (held) setPhase({ kind: "returning", n: judgeDesk() });
      else if (key) void run(key);
      else setPhase({ kind: "ask" });
    });
  }, []);

  const opening = phase.kind === "opening";
  const title =
    phase.kind === "ready"
      ? `Desk ${phase.n} is yours.`
      : phase.kind === "returning"
        ? `Desk ${phase.n ?? ""} is yours.`
        : opening
          ? "Opening your desk"
          : "Judge desks";

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
          <span className="lp-kicker">Zcash mainnet · real money</span>
          <h1 className="lp-h1 text-[clamp(34px,6vw,60px)]">{title}</h1>
          <p className="lp-line max-w-[34rem]">
            {phase.kind === "ready" || phase.kind === "returning"
              ? "A Hyperliquid wallet funded from shielded ZEC is ready to trade, and there is ZEC to fund a brand-new one."
              : "Six funded wallets, one per judge. Yours opens with the link in your ZECATHON submission."}
          </p>
        </div>

        <div className="flex max-w-[40rem] flex-col gap-6">
          <Desks
            checks={checks}
            mine={phase.kind === "ready" ? phase.n : phase.kind === "returning" ? (phase.n ?? undefined) : undefined}
          />

          {opening ? (
            <div className="lp-card p-5">
              <TxSteps
                steps={STEP_LABELS.map((label, i) => {
                  const states = stepStates(phase.step, phase.error !== undefined);
                  return {
                    label: i === 2 && phase.n ? `Opening desk ${phase.n}` : label,
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

          {phase.kind === "ready" || phase.kind === "returning" ? (
            <div className="flex flex-col gap-3">
              {phase.kind === "ready" && phase.shared ? (
                <p className="text-[13px] text-[var(--lp-ink-3)]">
                  Every desk has trades on it already; this one has the fewest.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <a href={TRADE_HREF} className="lp-btn lp-btn-accent">
                  Trade BTC now <ArrowRight size={18} />
                </a>
                <a href="/portfolio" className="lp-btn lp-btn-glass">
                  Your desk
                </a>
              </div>
              {phase.kind === "returning" ? (
                <button
                  type="button"
                  onClick={() => void leaveDesk()}
                  className="self-start text-[13px] text-[var(--lp-ink-3)] underline-offset-2 hover:text-[var(--lp-ink)] hover:underline"
                >
                  Give this desk back
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
                    placeholder="Paste your judge link"
                    aria-label="Your judge link"
                    autoComplete="off"
                    spellCheck={false}
                    className="num h-[52px] min-w-0 flex-1 rounded-full bg-[var(--lp-card-2)] px-5 text-[14px] shadow-[inset_0_0_0_1px_var(--lp-line)] outline-none focus:shadow-[inset_0_0_0_1px_#e04d26]"
                  />
                  <button type="submit" className="lp-btn lp-btn-accent">
                    Open my desk
                  </button>
                </form>
              ) : (
                <a href={JUDGE_ORIGIN} className="lp-btn lp-btn-accent self-start">
                  Open the judge desks <ArrowRight size={18} />
                </a>
              )}
              {phase.kind === "ask" && phase.error ? (
                <p className="text-[13px] text-[var(--down)]">{phase.error}</p>
              ) : null}
              <p className="text-[13px] text-[var(--lp-ink-3)]">
                It's the Working demo link in your submission.{" "}
                <Link href="https://mitoshi.xyz/markets" className="underline underline-offset-2">
                  Look around without a desk
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
