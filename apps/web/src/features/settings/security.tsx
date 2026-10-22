"use client";

import { Download, Eye, Fingerprint, KeyRound, Lock, LockOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { LOCK_MIN_CHARS, ZEC_NETWORK } from "@/constants";
import { Button, cx, toast } from "@/kit";
import { downloadBackup, makeBackup } from "../vault/backup";
import { lockVault, setVaultLock, vaultGet, vaultLockState } from "../vault/vault";

function Card({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: typeof Lock;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
          <Icon size={17} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-medium text-[15px]">{title}</h3>
          <p className="text-[13px] text-ink-2">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function NewPassphrase({ onDone, cta, busy }: { onDone: (p: string) => void; cta: string; busy: boolean }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const short = a.length > 0 && a.length < LOCK_MIN_CHARS;
  const mismatch = b.length > 0 && a !== b;
  return (
    <div className="flex flex-col gap-2">
      <input
        type="password"
        autoComplete="new-password"
        placeholder={`A passphrase, ${LOCK_MIN_CHARS}+ characters`}
        value={a}
        onChange={(e) => setA(e.target.value)}
        className="h-11 rounded-lg border border-hairline bg-bg px-3 text-[14px] outline-none focus:border-strong"
      />
      <input
        type="password"
        autoComplete="new-password"
        placeholder="The same passphrase again"
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="h-11 rounded-lg border border-hairline bg-bg px-3 text-[14px] outline-none focus:border-strong"
      />
      {short ? <p className="text-[12px] text-warning">At least {LOCK_MIN_CHARS} characters.</p> : null}
      {mismatch ? <p className="text-[12px] text-down">The two don't match.</p> : null}
      <Button
        tone="primary"
        disabled={busy || a.length < LOCK_MIN_CHARS || a !== b}
        onClick={() => onDone(a)}
        className="self-start"
      >
        {busy ? "Working…" : cta}
      </Button>
      <p className="text-[12px] text-muted">There is no reset: if it is lost, only your 24 words get you back in.</p>
    </div>
  );
}

/** The 24 words, behind a confirmation and then hold-to-reveal. */
function Words() {
  const [words, setWords] = useState<string[] | null>(null);
  const [holding, setHolding] = useState(false);
  if (!words) {
    return (
      <Button
        icon={<Eye size={15} />}
        className="self-start"
        onClick={() =>
          void vaultGet(ZEC_NETWORK, "mnemonic").then((m) => setWords(m ? new TextDecoder().decode(m).split(" ") : []))
        }
      >
        Show my 24 words
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ol
        className={cx(
          "grid grid-cols-3 gap-2 transition-[filter] duration-[var(--dur-state)] sm:grid-cols-4",
          holding ? "" : "pointer-events-none select-none blur-[7px]",
        )}
        aria-hidden={!holding}
      >
        {words.map((w, i) => (
          <li
            key={`${i}-${w}`}
            className="flex items-baseline gap-2 rounded-md border border-hairline bg-bg px-2.5 py-2 font-mono text-[13px]"
          >
            <span className="w-4 text-right text-[11px] text-muted">{i + 1}</span>
            {w}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <button
          type="button"
          onPointerDown={() => setHolding(true)}
          onPointerUp={() => setHolding(false)}
          onPointerLeave={() => setHolding(false)}
          onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setHolding(true)}
          onKeyUp={() => setHolding(false)}
          onBlur={() => setHolding(false)}
          className="flex h-11 flex-1 touch-none items-center justify-center gap-2 rounded-md border border-strong font-semibold text-[14px]"
        >
          {holding ? <Eye size={16} /> : <Fingerprint size={16} />}{" "}
          {holding ? "Showing while you hold" : "Hold to reveal"}
        </button>
        <Button onClick={() => setWords(null)}>Hide</Button>
      </div>
    </div>
  );
}

/** Backup, words and the passphrase lock. */
export function Security() {
  const [lockOn, setLockOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void vaultLockState().then((s) => setLockOn(s.lockOn));
  }, []);

  const run = (job: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    job().then(
      () => {
        toast({ tone: "up", title: done });
        setBusy(false);
        setBackupOpen(false);
        setLockOpen(false);
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      },
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-title">Security</h2>
      <Card
        icon={KeyRound}
        title="Recovery words"
        body="The 24 words bring back this wallet and every private wallet made from it, in any browser."
      >
        <Words />
      </Card>
      <Card
        icon={Download}
        title="Backup file"
        body="Your words and your private-wallet list in one file, locked with a passphrase. Restore picks up every wallet at once."
      >
        {backupOpen ? (
          <NewPassphrase
            busy={busy}
            cta="Download the backup"
            onDone={(p) => run(() => makeBackup(p).then(downloadBackup), "Backup saved: keep it somewhere safe")}
          />
        ) : (
          <Button icon={<Download size={15} />} className="self-start" onClick={() => setBackupOpen(true)}>
            Make a backup file
          </Button>
        )}
      </Card>
      <Card
        icon={lockOn ? Lock : LockOpen}
        title={lockOn ? "Passphrase lock is on" : "Passphrase lock"}
        body={
          lockOn
            ? "Opening Mitoshi in this browser asks for your passphrase. The vault key is stored only wrapped under it."
            : "Ask for a passphrase whenever Mitoshi opens in this browser. Without it, nothing in the vault can be read."
        }
      >
        {lockOn === null ? null : lockOn ? (
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Lock size={15} />}
              onClick={() => {
                lockVault();
                window.location.reload();
              }}
            >
              Lock now
            </Button>
            <Button
              tone="ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await setVaultLock(null);
                  setLockOn(false);
                }, "Passphrase lock is off")
              }
            >
              Turn it off
            </Button>
          </div>
        ) : lockOpen ? (
          <NewPassphrase
            busy={busy}
            cta="Turn the lock on"
            onDone={(p) =>
              run(async () => {
                await setVaultLock(p);
                setLockOn(true);
              }, "Passphrase lock is on")
            }
          />
        ) : (
          <Button icon={<Lock size={15} />} className="self-start" onClick={() => setLockOpen(true)}>
            Set a passphrase
          </Button>
        )}
      </Card>
      {error ? <p className="text-[13px] text-down">{error}</p> : null}
    </section>
  );
}
