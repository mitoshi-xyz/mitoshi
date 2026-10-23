"use client";

import type { LeakReport } from "@mitoshi/engine";
import { ChevronDown, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { useState } from "react";
import { cx } from "@/kit";

const LOOK: Record<LeakReport["level"], { box: string; ink: string; word: string; icon: typeof ShieldCheck }> = {
  green: { box: "border-up/30 bg-up-wash", ink: "text-up", word: "clear", icon: ShieldCheck },
  amber: { box: "border-warning/30 bg-warning/10", ink: "text-warning", word: "careful", icon: ShieldAlert },
  red: { box: "border-down/30 bg-down-wash", ink: "text-down", word: "this would link you", icon: ShieldX },
};

const RANK: Record<LeakReport["level"], number> = { green: 0, amber: 1, red: 2 };

/**
 * The leak meter on every send: green, amber or red. One line, with the reason that matters most; tap it for every
 * reason. `blocks` is set where red stops the send (funding a wallet) rather than warning (a withdrawal you choose).
 */
export function LeakMeter({ report, blocks = false }: { report: LeakReport; blocks?: boolean }) {
  const [open, setOpen] = useState(false);
  const look = LOOK[report.level];
  const Icon = look.icon;
  const worst = [...report.reasons].sort((a, b) => RANK[b.level] - RANK[a.level])[0];
  const word = blocks && report.level === "red" ? "blocked" : look.word;
  return (
    <div className={cx("rounded-xl border text-[13px]", look.box)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Icon size={15} className={cx("shrink-0", look.ink)} />
        <span className={cx("shrink-0 font-semibold", look.ink)}>{word}</span>
        <span className="min-w-0 flex-1 truncate text-ink-2">
          {report.level === "green" ? "nothing links this to you" : worst?.text}
        </span>
        <ChevronDown size={14} className={cx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <ul className="flex flex-col gap-1 px-3 pb-3">
          {report.reasons.map((r) => (
            <li key={r.text} className="flex gap-2 text-ink-2">
              <span
                aria-hidden
                className={cx(
                  "mt-[7px] size-1.5 shrink-0 rounded-full",
                  r.level === "green" ? "bg-up" : r.level === "amber" ? "bg-warning" : "bg-down",
                )}
              />
              {r.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
