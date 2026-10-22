"use client";

import { useState } from "react";
import { createWallet, isValidPhrase, newPhrase } from "./wallet-store";

/** First run: make a new wallet (show and confirm the 24 words) or restore one from a phrase. */
export function Onboarding() {
  const [mode, setMode] = useState<"choose" | "create" | "restore">("choose");
  const [phrase, setPhrase] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [input, setInput] = useState("");

  if (mode === "choose") {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-xl">Your private ZEC wallet</h2>
        <p className="opacity-70">It lives only in this browser. Mitoshi never sees your keys.</p>
        <button
          type="button"
          className="rounded-lg bg-white px-4 py-3 font-medium text-black"
          onClick={() => {
            setPhrase(newPhrase());
            setMode("create");
          }}
        >
          Create a new wallet
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/20 px-4 py-3"
          onClick={() => setMode("restore")}
        >
          Restore from a recovery phrase
        </button>
      </section>
    );
  }

  if (mode === "create") {
    const words = phrase.split(" ");
    return (
      <section className="flex flex-col gap-4">
        <h2 className="font-semibold text-xl">Write down these 24 words</h2>
        <p className="opacity-70">They are the only way back into this wallet. Keep them offline.</p>
        <ol className={`grid grid-cols-3 gap-2 font-mono text-sm ${revealed ? "" : "select-none blur-sm"}`}>
          {words.map((w, i) => (
            <li key={`${i}-${w}`} className="rounded border border-white/10 px-2 py-1">
              <span className="opacity-40">{i + 1}.</span> {w}
            </li>
          ))}
        </ol>
        <button type="button" className="self-start text-sm underline" onClick={() => setRevealed((r) => !r)}>
          {revealed ? "Hide words" : "Show words"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />I wrote them down
        </label>
        <button
          type="button"
          disabled={!saved}
          className="rounded-lg bg-white px-4 py-3 font-medium text-black disabled:opacity-40"
          onClick={() => void createWallet(phrase, false)}
        >
          Create wallet
        </button>
      </section>
    );
  }

  const valid = isValidPhrase(input);
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-xl">Restore a wallet</h2>
      <textarea
        className="min-h-28 rounded-lg border border-white/20 bg-transparent p-3 font-mono text-sm"
        placeholder="Your 24 words, separated by spaces"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        autoComplete="off"
      />
      {input && !valid ? <p className="text-red-400 text-sm">That is not a valid recovery phrase.</p> : null}
      <p className="text-sm opacity-60">
        Restoring scans the chain from the Ironwood upgrade onward, which takes a while.
      </p>
      <button
        type="button"
        disabled={!valid}
        className="rounded-lg bg-white px-4 py-3 font-medium text-black disabled:opacity-40"
        onClick={() => void createWallet(input, true)}
      >
        Restore wallet
      </button>
    </section>
  );
}
