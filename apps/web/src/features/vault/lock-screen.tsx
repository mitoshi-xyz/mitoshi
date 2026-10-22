"use client";

import { KeyRound, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Button, Wait } from "@/kit";
import { startJobs } from "../private-wallets/jobs";
import { loadRegistry } from "../private-wallets/registry-store";
import { bootWallet } from "../wallet/wallet-store";
import { forgetVault, unlockVault } from "./vault";

/** Unlocks the vault, then opens what the lock was holding back: the wallet engine and the private wallets. */
export async function unlockAndBoot(passphrase: string) {
  await unlockVault(passphrase);
  await bootWallet();
  await loadRegistry();
  startJobs();
}

/** The locked app: one field, one button. Nothing about the wallet is readable until it opens. */
export function LockScreen() {
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgetting, setForgetting] = useState(false);
  const [typed, setTyped] = useState("");
  return (
    <form
      className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-5 py-16 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        unlockAndBoot(passphrase).then(
          () => setPassphrase(""),
          (err: unknown) => {
            setError(err instanceof Error ? err.message : String(err));
            setBusy(false);
          },
        );
      }}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-surface-1 text-accent">
        <LockKeyhole size={28} />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="type-heading">Mitoshi is locked</h1>
        <p className="text-ink-2">Your passphrase opens the vault in this browser. It never leaves this device.</p>
      </div>
      <label className="flex w-full flex-col gap-2 text-left">
        <span className="type-label text-muted">Passphrase</span>
        <input
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="h-12 rounded-lg border border-hairline bg-surface-1 px-3 text-[15px] outline-none focus:border-strong"
        />
      </label>
      {error ? <p className="text-[13px] text-down">{error}</p> : null}
      {busy ? (
        <Wait verb="Opening the vault" />
      ) : (
        <Button
          type="submit"
          tone="primary"
          size="lg"
          className="w-full"
          icon={<KeyRound size={17} />}
          disabled={!passphrase}
        >
          Unlock
        </Button>
      )}
      {forgetting ? (
        <div className="flex w-full flex-col gap-2 rounded-lg border border-down/30 bg-down-wash p-3 text-left text-[13px]">
          <p>
            This erases the vault in this browser: your words, the wallet file and the private-wallet list. Your money
            stays on the chains, and your 24 words bring it all back. Type <span className="num">FORGET</span> to go on.
          </p>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Type FORGET to confirm"
            className="num h-10 rounded-md border border-hairline bg-bg px-3 outline-none focus:border-strong"
          />
          <Button
            tone="down"
            disabled={typed !== "FORGET"}
            onClick={() => void forgetVault().then(() => window.location.assign("/wallet"))}
          >
            Forget this browser's vault
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => setForgetting(true)} className="text-[12px] text-muted hover:text-ink">
          Forgot it? Start over from your 24 words
        </button>
      )}
    </form>
  );
}
