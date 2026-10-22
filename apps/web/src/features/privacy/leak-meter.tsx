"use client";

import type { LeakReport } from "@mitoshi/engine";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { cx } from "@/kit";

const LOOK: Record<LeakReport["level"], { box: string; ink: string; word: string; icon: typeof ShieldCheck }> = {
  green: { box: "border-up/30 bg-up-wash", ink: "text-up", word: "clear", icon: ShieldCheck },
  amber: { box: "border-warning/30 bg-warning/10", ink: "text-warning", word: "careful", icon: ShieldAlert },
  red: { box: "border-down/30 bg-down-wash", ink: "text-down", word: "this would link you", icon: ShieldX },
};

/**
 * The leak meter on every send: green, amber or red, with each reason in words. `blocks` is set
 * where red stops the send (funding a wallet) rather than warning (a withdrawal you choose).
 */
export function LeakMeter({ report, blocks = false }: { report: LeakReport; blocks?: boolean }) {
  const look = LOOK[report.level];
  const Icon = look.icon;
  return (
    <div className={cx("flex flex-col gap-1.5 rounded-lg border p-3 text-[13px]", look.box)}>
      <span className={cx("flex items-center gap-1.5 font-semibold", look.ink)}>
        <Icon size={15} /> Leak meter · {blocks && report.level === "red" ? "blocked" : look.word}
      </span>
      <ul className="flex flex-col gap-1">
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
    </div>
  );
}
