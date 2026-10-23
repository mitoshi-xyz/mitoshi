"use client";

import { LADDER_ZAT, liveWallets, type Venue, ZAT_PER_ZEC } from "@mitoshi/engine";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cx, Sheet, Switch } from "@/kit";
import { VenueMark } from "../marks/mark";
import { setKeepReady } from "./jobs";
import { useRegistry } from "./registry-store";
import { STATUS, VENUE_ORDER, VENUES } from "./venues";

const ZEC_DIGITS = 8;
const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");
/** The size a venue starts at when its switch goes on. */
const DEFAULT_SIZE = LADDER_ZAT[2];

/** What "keep one ready" holds for a venue right now, in two words. */
function warmWord(venue: Venue, r: ReturnType<typeof useRegistry>): { text: string; ok: boolean } {
  const live = liveWallets(r, venue).filter((w) => w.status !== "trading");
  if (live.some((w) => w.status === "ready")) return { text: "Ready", ok: true };
  const next = live[0];
  return next ? { text: STATUS[next.status].word, ok: false } : { text: "Waiting for ZEC", ok: false };
}

/** "Keep one ready": while Mitoshi is open, a funded wallet waits per venue, so a trade never waits for its funding. */
export function KeepReady() {
  const registry = useRegistry();
  const [sizing, setSizing] = useState<Venue | null>(null);
  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-title">Keep one ready</h2>
      <ul className="flex flex-col divide-y divide-[var(--hairline)] overflow-hidden rounded-xl border border-hairline bg-surface-1">
        {VENUE_ORDER.map((id) => {
          const v = VENUES[id];
          const size = registry.keepReady[id];
          const warm = size ? warmWord(id, registry) : null;
          return (
            <li key={id} className={cx("flex items-center gap-3 px-3 py-3", !v.live && "opacity-50")}>
              <VenueMark venue={id} size={32} />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="font-medium text-[14px]">{v.name}</span>
                {warm ? (
                  <span className={cx("text-[12px]", warm.ok ? "text-up" : "text-muted")}>{warm.text}</span>
                ) : null}
              </span>
              {size ? (
                <button
                  type="button"
                  onClick={() => setSizing(id)}
                  className="num flex h-8 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] hover:bg-surface-3"
                >
                  {zec(size)} ZEC <ChevronDown size={13} className="text-muted" />
                </button>
              ) : null}
              <Switch
                on={Boolean(size)}
                disabled={!v.live}
                label={`Keep a ${v.name} wallet ready`}
                onChange={(on) => setKeepReady(id, on ? (size ?? DEFAULT_SIZE) : null)}
              />
            </li>
          );
        })}
      </ul>
      <Sheet open={sizing !== null} onClose={() => setSizing(null)} title="Size">
        <div className="grid grid-cols-4 gap-2">
          {LADDER_ZAT.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                if (sizing) setKeepReady(sizing, s);
                setSizing(null);
              }}
              className={cx(
                "num h-12 rounded-xl text-[14px]",
                sizing && registry.keepReady[sizing] === s ? "bg-ink text-bg" : "bg-surface-2 hover:bg-surface-3",
              )}
            >
              {zec(s)}
            </button>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
