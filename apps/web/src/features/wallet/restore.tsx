"use client";

import { wordlist } from "@scure/bip39/wordlists/english.js";
import { FileKey2 } from "lucide-react";
import { useState } from "react";
import { Button, Segmented } from "@/kit";
import { startRecovery } from "../private-wallets/recover";
import { mergeRegistry } from "../private-wallets/registry-store";
import { openBackup } from "../vault/backup";
import { EngineLine, Step } from "./onboarding-parts";
import { createWallet, isValidPhrase, type WalletState, walletState } from "./wallet-store";

const WORDS = 24;
const KNOWN = new Set(wordlist);

/**
 * Restore: from the 24 words (then the private wallets they made are found by a slow, private
 * scan), or from a backup file (words and the wallet list together, under its passphrase).
 */
export function Restore({ w, engineReady, onBack }: { w: WalletState; engineReady: boolean; onBack: () => void }) {
  const [from, setFrom] = useState<"words" | "file">("words");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const typed = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const unknown = typed.filter((t) => !KNOWN.has(t));
  const valid = isValidPhrase(input);

  const fromFile = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const contents = await openBackup(await file.text(), passphrase);
      await createWallet(contents.mnemonic, true);
      if (contents.registry) mergeRegistry(contents.registry);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Step title="Restore a wallet" onBack={onBack}>
      <Segmented
        options={[
          { value: "words", label: "24 words" },
          { value: "file", label: "Backup file" },
        ]}
        value={from}
        onChange={setFrom}
        className="self-start"
      />
      {from === "words" ? (
        <>
          <p className="-mt-2 text-[15px] text-ink-2">Type or paste your 24 words, in order, separated by spaces.</p>
          <textarea
            className="min-h-36 rounded-lg border border-hairline bg-surface-1 p-3 font-mono text-[14px] leading-relaxed outline-none focus:border-strong"
            placeholder="word word word …"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <div className="flex items-center justify-between gap-3 text-[12px]">
            <span className="num text-muted">
              {typed.length} / {WORDS} words
            </span>
            {unknown.length ? (
              <span className="text-down">
                “{unknown[0]}” is not a recovery word{unknown.length > 1 ? ` (and ${unknown.length - 1} more)` : ""}
              </span>
            ) : typed.length === WORDS && !valid ? (
              <span className="text-down">These 24 words don't add up: check the order and spelling</span>
            ) : valid ? (
              <span className="text-up">Valid recovery phrase</span>
            ) : null}
          </div>
          <p className="text-[13px] text-ink-2">
            Restoring scans the chain from the Ironwood upgrade onward, privately, in this browser, then looks for the
            private wallets these words made, one address at a time. You can browse while it runs.
          </p>
          <Button
            tone="primary"
            size="lg"
            disabled={!valid || !engineReady}
            onClick={() =>
              void createWallet(input, true).then(() => walletState().phase !== "error" && startRecovery())
            }
          >
            {valid && !engineReady ? "Waiting for the wallet engine…" : "Restore wallet"}
          </Button>
        </>
      ) : (
        <>
          <p className="-mt-2 text-[15px] text-ink-2">
            A backup file holds your words and your private-wallet list, locked with the passphrase you chose.
          </p>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-strong border-dashed p-4 hover:bg-surface-1">
            <FileKey2 size={20} className="text-accent" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-[14px]">{file ? file.name : "Choose the backup file"}</span>
              <span className="text-[12px] text-muted">mitoshi-backup-….json</span>
            </span>
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="type-label text-muted">Its passphrase</span>
            <input
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="h-12 rounded-lg border border-hairline bg-surface-1 px-3 text-[15px] outline-none focus:border-strong"
            />
          </label>
          {error ? <p className="text-[13px] text-down">{error}</p> : null}
          <Button
            tone="primary"
            size="lg"
            disabled={!file || !passphrase || !engineReady || busy}
            onClick={() => void fromFile()}
          >
            {busy ? "Opening the backup…" : !engineReady ? "Waiting for the wallet engine…" : "Restore from the file"}
          </Button>
        </>
      )}
      <EngineLine w={w} />
    </Step>
  );
}
