"use client";

import { Moon, ScanSearch, Sun, Trash2, Vibrate, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, cue, cx, type FeedbackPrefs, feedbackPrefs, setFeedbackPrefs, Wait } from "@/kit";
import { KeepReady } from "../private-wallets/keep-ready";
import { startRecovery, useRecovery } from "../private-wallets/recover";
import { useRegistry } from "../private-wallets/registry-store";
import { VENUES } from "../private-wallets/venues";
import { applyTheme, currentTheme } from "../theme/theme";
import { forgetVault } from "../vault/vault";
import { stopWallet, useWallet } from "../wallet/wallet-store";
import { Security } from "./security";
import { Status } from "./status";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cx(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--dur-state)]",
        on ? "bg-accent" : "bg-surface-3",
      )}
    >
      <span
        className={cx(
          "absolute top-1 size-5 rounded-full bg-bg transition-[left] duration-[var(--dur-state)]",
          on ? "left-6" : "left-1",
        )}
      />
    </button>
  );
}

function Recovery() {
  const r = useRecovery();
  const w = useWallet();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
          <ScanSearch size={17} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-medium text-[15px]">Find wallets from your words</h3>
          <p className="text-[13px] text-ink-2">
            After a restore from words alone, this finds the private wallets they made, by asking each venue about one
            address at a time, seconds apart, so no venue sees them asked about together.
          </p>
        </div>
      </div>
      {r.running ? (
        <Wait
          verb={
            r.progress
              ? `Checking ${VENUES[r.progress.venue].name} wallet #${r.progress.index + 1} · ${r.progress.found} found`
              : "Starting"
          }
        />
      ) : r.result !== null ? (
        <p className="text-[13px] text-up">
          Done:{" "}
          {r.result === 0
            ? "no other wallets were made from these words."
            : `found ${r.result}; they are on Private wallets.`}
        </p>
      ) : r.error ? (
        <p className="text-[13px] text-down">{r.error}</p>
      ) : null}
      {!r.running ? (
        <Button className="self-start" disabled={w.phase !== "ready"} onClick={startRecovery}>
          {r.result !== null ? "Look again" : "Find my wallets"}
        </Button>
      ) : null}
    </div>
  );
}

function Feel() {
  const [prefs, setPrefs] = useState<FeedbackPrefs>({ sound: true, haptics: true });
  const [light, setLight] = useState(false);
  useEffect(() => {
    setPrefs(feedbackPrefs());
    setLight(currentTheme() === "light");
  }, []);
  const save = (p: FeedbackPrefs) => {
    setPrefs(p);
    setFeedbackPrefs(p);
    cue("tap");
  };
  const rows = [
    {
      icon: Volume2,
      label: "Sounds",
      body: "Quiet cues for sends, fills, wins and losses",
      on: prefs.sound,
      set: (v: boolean) => save({ ...prefs, sound: v }),
    },
    {
      icon: Vibrate,
      label: "Haptics",
      body: "A small buzz on the same moments (phones that support it)",
      on: prefs.haptics,
      set: (v: boolean) => save({ ...prefs, haptics: v }),
    },
    {
      icon: light ? Sun : Moon,
      label: "Cream theme",
      body: "Mitoshi's light paper look instead of the dark terminal",
      on: light,
      set: (v: boolean) => {
        applyTheme(v ? "light" : "dark");
        setLight(v);
      },
    },
  ];
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-title">Feel</h2>
      <ul className="overflow-hidden rounded-xl border border-hairline bg-surface-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 border-hairline border-b px-4 py-3 last:border-b-0">
            <r.icon size={17} className="text-ink-2" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-medium text-[14px]">{r.label}</span>
              <span className="text-[12px] text-muted">{r.body}</span>
            </span>
            <Toggle on={r.on} onChange={r.set} label={r.label} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Forget() {
  const w = useWallet();
  const registry = useRegistry();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const b = w.summary?.balance;
  const zat = b?.total ?? 0;
  const live = registry.wallets.filter((x) => !["retired", "refunded"].includes(x.status)).length;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-title text-down">Forget this browser</h2>
      <div className="flex flex-col gap-3 rounded-xl border border-down/30 bg-down-wash p-4 text-[13px]">
        <p>
          Erases the vault here: your words, the wallet file, the private-wallet list and the caches. Your money stays
          on the chains; your 24 words (or a backup file) bring it all back.
        </p>
        {zat > 0 || live > 0 ? (
          <p className="font-medium text-down">
            This browser holds {zat > 0 ? "a balance" : ""}
            {zat > 0 && live > 0 ? " and " : ""}
            {live > 0 ? `${live} live private wallet${live === 1 ? "" : "s"}` : ""}. Make sure your words or a backup
            file are safe first.
          </p>
        ) : null}
        {open ? (
          <div className="flex flex-col gap-2">
            <span>
              Type <span className="num">FORGET</span> to go on.
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              aria-label="Type FORGET to confirm"
              className="num h-10 rounded-md border border-hairline bg-bg px-3 outline-none focus:border-strong"
            />
            <Button
              tone="down"
              icon={<Trash2 size={15} />}
              disabled={typed !== "FORGET" || busy}
              className="self-start"
              onClick={() => {
                setBusy(true);
                stopWallet();
                void forgetVault().then(() => window.location.assign("/wallet"));
              }}
            >
              {busy ? "Forgetting…" : "Forget everything here"}
            </Button>
          </div>
        ) : (
          <Button tone="down" icon={<Trash2 size={15} />} className="self-start" onClick={() => setOpen(true)}>
            Forget this browser
          </Button>
        )}
      </div>
    </section>
  );
}

/** Settings: security (words, backup, lock), private wallets, feel, live status, and Forget. */
export function SettingsView() {
  const w = useWallet();
  const has = w.phase === "ready" || w.phase === "syncing";
  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h1 className="type-headline-lg">Settings</h1>
        <p className="text-ink-2">Everything here is stored in this browser only.</p>
      </div>
      {has ? <Security /> : null}
      {has ? (
        <section className="flex flex-col gap-3">
          <h2 className="type-title">Private wallets</h2>
          <KeepReady />
          <Recovery />
        </section>
      ) : null}
      <Feel />
      <Status />
      {has ? <Forget /> : null}
    </section>
  );
}
