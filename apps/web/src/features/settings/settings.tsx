"use client";

import { Moon, ScanSearch, Sun, Trash2, Vibrate, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, cue, type FeedbackPrefs, feedbackPrefs, Switch, setFeedbackPrefs, Wait } from "@/kit";
import { startRecovery, useRecovery } from "../private-wallets/recover";
import { useRegistry } from "../private-wallets/registry-store";
import { VENUES } from "../private-wallets/venues";
import { applyTheme, currentTheme } from "../theme/theme";
import { forgetVault } from "../vault/vault";
import { stopWallet, useWallet } from "../wallet/wallet-store";
import { Security } from "./security";

function Recovery() {
  const r = useRecovery();
  const w = useWallet();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-accent">
          <ScanSearch size={17} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="font-medium text-[15px]">Find wallets from your words</h3>
          <p className="text-[13px] text-ink-2">After a restore from words only</p>
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
          {r.result === 0 ? "no other wallets were made from these words." : `found ${r.result}; they are on Wallets.`}
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
      on: prefs.sound,
      set: (v: boolean) => save({ ...prefs, sound: v }),
    },
    {
      icon: Vibrate,
      label: "Haptics",
      on: prefs.haptics,
      set: (v: boolean) => save({ ...prefs, haptics: v }),
    },
    {
      icon: light ? Sun : Moon,
      label: "Cream theme",
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
            <span className="min-w-0 flex-1 font-medium text-[14px]">{r.label}</span>
            <Switch on={r.on} onChange={r.set} label={r.label} />
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
        <p>Erases this browser's vault. Your money stays on the chains; your words bring it back.</p>
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

/** Settings: security (words, backup, lock, finding wallets from words), feel, and Forget. Status has its own page. */
export function SettingsView() {
  const w = useWallet();
  const has = w.phase === "ready" || w.phase === "syncing";
  return (
    <section className="flex flex-col gap-8">
      <h1 className="type-headline-lg">Settings</h1>
      {has ? <Security /> : null}
      {has ? <Recovery /> : null}
      <Feel />
      {has ? <Forget /> : null}
    </section>
  );
}
