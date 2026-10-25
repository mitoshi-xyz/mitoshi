"use client";

import { wordlist } from "@scure/bip39/wordlists/english.js";
import { Eye, Fingerprint, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, cx, TxSteps, Wait } from "@/kit";
import { Hanko } from "../judge/hanko";
import { useOnJudgeHost } from "../judge/judge";
import { Story } from "../welcome/story";
import { EngineLine, Step } from "./onboarding-parts";
import { Restore } from "./restore";
import { createWallet, newPhrase, useWallet } from "./wallet-store";

const WORDS = 24;
const CHECKS = 3;
const CHOICES = 4;
const UINT32_RANGE = 4_294_967_296;

function randomInt(n: number): number {
  const [v] = crypto.getRandomValues(new Uint32Array(1));
  return Math.floor(((v ?? 0) / UINT32_RANGE) * n);
}

/** Three positions to check, and for each the right word among a few others. */
function makeChecks(words: string[]) {
  const positions = new Set<number>();
  while (positions.size < CHECKS) positions.add(randomInt(WORDS));
  return [...positions]
    .sort((a, b) => a - b)
    .map((i) => {
      const options = new Set([words[i] ?? ""]);
      while (options.size < CHOICES) options.add(wordlist[randomInt(wordlist.length)] ?? "");
      return { i, options: [...options].sort() };
    });
}

/** First run: the story, then make a wallet (write down 24 words, check three) or restore one. */
/** First run, or on judge.mitoshi.xyz without a desk yet: the way to the desk instead of making a wallet there. */
export function Onboarding() {
  return useOnJudgeHost() ? <NoDesk /> : <FirstRun />;
}

function NoDesk() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <Hanko size={64} />
      <h1 className="type-headline-md">Open your judge wallet</h1>
      <p className="text-[14px] text-ink-2">It opens with the link in your ZECATHON submission.</p>
      <a href="/" className="inline-flex h-12 items-center rounded-full bg-accent px-6 font-semibold text-accent-ink">
        Open my wallet
      </a>
      <a href="https://mitoshi.xyz" className="text-[13px] text-muted hover:text-ink hover:underline">
        Your own wallet lives at mitoshi.xyz
      </a>
    </section>
  );
}

function FirstRun() {
  const w = useWallet();
  const [mode, setMode] = useState<"story" | "words" | "check" | "restore">("story");
  const [phrase, setPhrase] = useState("");
  const [holding, setHolding] = useState(false);
  const [seen, setSeen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const words = useMemo(() => phrase.split(" ").filter(Boolean), [phrase]);
  const checks = useMemo(() => (words.length === WORDS ? makeChecks(words) : []), [words]);
  const engineReady = w.phase === "empty";
  const hold = (on: boolean) => {
    setHolding(on);
    if (on) setSeen(true);
  };

  if (w.phase === "creating") {
    const step = w.creatingStep;
    return (
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6 py-6">
        <h1 className="type-heading">Setting up your private wallet</h1>
        <TxSteps
          steps={[
            { label: "Saving your words, encrypted, in this browser", state: step === "vault" ? "active" : "done" },
            {
              label: "Making your shielded account",
              state: step === "account" ? "active" : step === "vault" ? "pending" : "done",
              ...(step === "account" ? { detail: <Wait verb="Reading the chain's state, privately" /> } : {}),
            },
            { label: "First sync with the Zcash network", state: "pending" },
          ]}
        />
      </div>
    );
  }

  if (mode === "story") {
    return (
      <Story
        onCreate={() => {
          setPhrase(newPhrase());
          setSeen(false);
          setAnswers({});
          setMode("words");
        }}
        onRestore={() => setMode("restore")}
        footer={<EngineLine w={w} />}
      />
    );
  }

  if (mode === "words") {
    return (
      <Step n={1} title="Write down these 24 words" onBack={() => setMode("story")}>
        <p className="-mt-2 text-[15px] text-ink-2">
          They are the only way back into this wallet and every private wallet made from it. Paper is best; keep it
          offline.
        </p>
        <ol
          className={cx(
            "grid grid-cols-3 gap-2 transition-[filter] duration-[var(--dur-state)] sm:grid-cols-4",
            holding ? "" : "pointer-events-none select-none blur-[7px]",
          )}
          aria-hidden={!holding}
        >
          {words.map((word, i) => (
            <li
              key={`${i}-${word}`}
              className="flex items-baseline gap-2 rounded-md border border-hairline bg-surface-1 px-2.5 py-2 font-mono text-[13px]"
            >
              <span className="w-4 text-right text-[11px] text-muted">{i + 1}</span>
              {word}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onPointerDown={() => hold(true)}
          onPointerUp={() => hold(false)}
          onPointerLeave={() => hold(false)}
          onPointerCancel={() => hold(false)}
          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && hold(true)}
          onKeyUp={() => hold(false)}
          onBlur={() => hold(false)}
          className={cx(
            "flex h-14 touch-none items-center justify-center gap-2 rounded-md border font-semibold text-[15px] transition-colors duration-[var(--dur-hover)]",
            holding ? "border-accent bg-accent-wash text-accent" : "border-strong hover:bg-surface-1",
          )}
        >
          {holding ? <Eye size={18} /> : <Fingerprint size={18} />}
          {holding ? "Showing while you hold" : "Hold to reveal"}
        </button>
        <p className="flex gap-2 text-[13px] text-ink-2">
          <ShieldAlert size={16} className="mt-0.5 shrink-0 text-warning" />
          Never type them into a website or send them to anyone. Mitoshi will never ask for them.
        </p>
        <Button tone="primary" size="lg" disabled={!seen} onClick={() => setMode("check")}>
          I wrote them down
        </Button>
      </Step>
    );
  }

  if (mode === "check") {
    const right = checks.every((c) => answers[c.i] === words[c.i]);
    return (
      <Step n={2} title="Check three words" onBack={() => setMode("words")}>
        {checks.map((c) => (
          <fieldset key={c.i} className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] text-ink-2">
              Word <span className="num text-ink">#{c.i + 1}</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {c.options.map((o) => {
                const picked = answers[c.i] === o;
                const wrong = picked && o !== words[c.i];
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setAnswers({ ...answers, [c.i]: o })}
                    aria-pressed={picked}
                    className={cx(
                      "h-11 rounded-md border font-mono text-[13px] transition-colors duration-[var(--dur-hover)]",
                      picked
                        ? wrong
                          ? "border-down bg-down-wash text-down"
                          : "border-up bg-up-wash text-up"
                        : "border-hairline hover:border-strong",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <Button
          tone="primary"
          size="lg"
          disabled={!right || !engineReady}
          onClick={() => void createWallet(phrase, false)}
        >
          {right && !engineReady ? "Waiting for the wallet engine…" : "Create my wallet"}
        </Button>
        <EngineLine w={w} />
      </Step>
    );
  }

  return <Restore w={w} engineReady={engineReady} onBack={() => setMode("story")} />;
}
