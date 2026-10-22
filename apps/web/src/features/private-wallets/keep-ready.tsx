"use client";

import { LADDER_ZAT, liveWallets, type Venue, ZAT_PER_ZEC } from "@mitoshi/engine";
import { cx } from "@/kit";
import { VenueMark } from "../marks/mark";
import { setKeepReady } from "./jobs";
import { useRegistry } from "./registry-store";
import { STATUS, VENUE_ORDER, VENUES } from "./venues";

const ZEC_DIGITS = 8;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

/** Which wallet "keep one ready" is holding for a venue right now, in words. */
function warmWord(venue: Venue, r: ReturnType<typeof useRegistry>): { text: string; ok: boolean } {
  const live = liveWallets(r, venue).filter((w) => w.status !== "trading");
  const ready = live.find((w) => w.status === "ready");
  if (ready) return { text: "One is ready now", ok: true };
  const next = live[0];
  if (next) return { text: `${STATUS[next.status].word} one`, ok: false };
  return { text: "Starts when you have enough ready", ok: false };
}

/**
 * "Keep one ready": while Mitoshi is open, hold a funded wallet per venue at a chosen size, so a
 * trade never waits for the funding.
 */
export function KeepReady() {
  const registry = useRegistry();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="type-title">Keep one ready</h2>
        <p className="text-[13px] text-ink-2">
          While Mitoshi is open, it holds a funded wallet per venue, so a trade never waits for the funding.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {VENUE_ORDER.map((id) => {
          const v = VENUES[id];
          const size = registry.keepReady[id];
          const warm = size ? warmWord(id, registry) : null;
          return (
            <div
              key={id}
              className={cx(
                "flex items-center gap-3 rounded-xl border p-3",
                size ? "border-accent/40 bg-accent-wash" : "border-hairline bg-surface-1",
                !v.live && "opacity-50",
              )}
            >
              <VenueMark venue={id} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium text-[14px]">{v.name}</span>
                <span className={cx("truncate text-[12px]", warm?.ok ? "text-up" : "text-muted")}>
                  {!v.live ? "Opens with Polymarket trading" : warm ? warm.text : "Off"}
                </span>
              </div>
              <select
                aria-label={`Keep a ${v.name} wallet ready`}
                disabled={!v.live}
                value={size ?? ""}
                onChange={(e) => setKeepReady(id, e.target.value ? Number(e.target.value) : null)}
                className="num h-9 rounded-full border border-strong bg-bg px-3 text-[13px] outline-none focus:border-ink"
              >
                <option value="">Off</option>
                {LADDER_ZAT.map((s) => (
                  <option key={s} value={s}>
                    {zec(s)} ZEC
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}
