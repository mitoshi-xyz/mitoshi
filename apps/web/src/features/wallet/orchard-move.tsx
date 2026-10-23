"use client";

import { CROSSING_FEE_ZAT, MIN_DENOMINATION_ZAT, TRANSFER_DELAY_MEAN_MS, ZAT_PER_ZEC } from "@mitoshi/engine";
import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { Button, Sheet } from "@/kit";
import { clearMigration, migrationPlan, startMigration } from "../private-wallets/migration";
import { useRegistry } from "../private-wallets/registry-store";
import { useNow } from "../private-wallets/use-now";
import { inMinutes } from "../private-wallets/wallet-steps";
import { MASK } from "../shell/prefs";

const ZEC_DIGITS = 8;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

const ROW =
  "mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-cream/15 px-3 py-2.5 text-[13px]";

/**
 * ZEC still in the old Orchard pool can't fund or withdraw (spending it beside Ironwood would publish the crossing).
 * This moves it across the ZIP 318 way, after the user agrees to the whole schedule. Shows nothing when there is none.
 */
export function OrchardMove({ orchardZat, hidden }: { orchardZat: number; hidden: boolean }) {
  const registry = useRegistry();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const parts = registry.migration;

  if (parts) {
    const sent = parts.filter((p) => p.status === "sent").length;
    const failed = parts.find((p) => p.status === "failed");
    const next = parts.filter((p) => p.status === "waiting").sort((a, b) => a.at - b.at)[0];
    return (
      <div className={ROW}>
        <span className={failed ? "text-down" : "text-cream/80"}>
          {failed
            ? `A part stopped: ${failed.error ?? "unknown"}`
            : next
              ? `To Ironwood · ${sent} of ${parts.length} · next ${inMinutes(next.at - now)}`
              : `Moved to Ironwood · ${parts.length} parts`}
        </span>
        {next && !failed ? null : (
          <button type="button" onClick={clearMigration} className="font-semibold text-cream hover:underline">
            {failed ? "Plan again" : "Done"}
          </button>
        )}
      </div>
    );
  }

  if (orchardZat < MIN_DENOMINATION_ZAT + CROSSING_FEE_ZAT) return null;
  const plan = open ? migrationPlan() : null;
  const moving = plan ? plan.parts.reduce((n, p) => n + p, 0) : 0;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${ROW} hover:bg-cream/5`}>
        <span className="num text-cream/80">{hidden ? MASK : `${zec(orchardZat)} ZEC`} in the old Orchard pool</span>
        <span className="flex items-center gap-1 font-semibold text-cream">
          Move to Ironwood <ArrowRight size={14} />
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Move to Ironwood">
        {plan?.parts.length ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col items-center gap-1">
              <span className="num font-semibold text-[40px] leading-none">{zec(moving)}</span>
              <span className="text-[13px] text-muted">ZEC in {plan.parts.length} standard parts</span>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {plan.parts.map((p, i) => (
                <span key={i} className="num rounded-full bg-surface-2 px-3 py-1.5 text-[13px]">
                  {zec(p)}
                </span>
              ))}
            </div>
            <ul className="flex flex-col gap-2 text-[13px] text-ink-2">
              <li className="flex gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-up" /> One part at a time, each at a random moment,{" "}
                {inMinutes(plan.parts.length * TRANSFER_DELAY_MEAN_MS)} in all while Mitoshi is open
              </li>
              <li className="flex gap-2">
                <Check size={15} className="mt-0.5 shrink-0 text-up" /> Each looks like every other ZIP 318 migration
              </li>
              {plan.residual > 0 ? (
                <li className="flex gap-2 text-muted">
                  <span className="w-[15px] shrink-0 text-center">·</span> {zec(plan.residual)} ZEC is too small to move
                  and stays
                </li>
              ) : null}
            </ul>
            <Button
              tone="primary"
              size="lg"
              onClick={() => {
                startMigration(plan.parts);
                setOpen(false);
              }}
            >
              Start moving
            </Button>
          </div>
        ) : (
          <p className="text-[13px] text-ink-2">
            No Orchard note here is big enough to move on its own (0.01 ZEC plus its fee).
          </p>
        )}
      </Sheet>
    </>
  );
}
