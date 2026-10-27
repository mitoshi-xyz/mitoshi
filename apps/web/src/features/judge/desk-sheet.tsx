"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { cx, Drawer } from "@/kit";
import { openPublicView } from "../private-wallets/drawers";
import { useRegistry } from "../private-wallets/registry-store";
import { Hanko } from "./hanko";
import { leaveDesk, type PathStep, useJudgeDesk, useSeenSteps } from "./judge";

let pathOpen = false;
const pathListeners = new Set<() => void>();
function setPathOpen(v: boolean) {
  pathOpen = v;
  for (const l of pathListeners) l();
}

/** Opens the judge's path from anywhere (the desk chip, the money card). */
export const openJudgePath = () => setPathOpen(true);

function usePathOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      pathListeners.add(l);
      return () => {
        pathListeners.delete(l);
      };
    },
    () => pathOpen,
    () => false,
  );
}

interface Step {
  id: PathStep;
  title: string;
  detail: string;
  done: boolean;
  go: { href: string } | { onClick: () => void };
}

/** The path through the judges' wallet, ticked from what it has actually done (and what the judge has looked at). */
function usePath(onGo: () => void): Step[] {
  const registry = useRegistry();
  const seen = useSeenSteps();
  // The first wallet is the one funded before judging.
  const first = [...registry.wallets].sort((a, b) => a.createdAt - b.createdAt)[0];
  const traded = registry.wallets.some((w) => (w.trades?.length ?? 0) > 0);
  return [
    {
      id: "trade",
      title: "Trade from the ready wallet",
      detail: "Long or short BTC on Hyperliquid · 30 s",
      done: traded,
      go: { href: "/trade#BTC" },
    },
    {
      id: "public",
      title: "See what the public sees",
      detail: "One wallet, its trades, no history",
      done: seen.includes("public"),
      go: {
        onClick: () => {
          onGo();
          if (first) openPublicView(first.id);
        },
      },
    },
    {
      id: "receipt",
      title: "Check the funding on chain",
      detail: "Its receipt in History, with the explorer",
      done: seen.includes("receipt"),
      go: { href: "/portfolio" },
    },
  ];
}

function JudgeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = usePath(onClose);
  const done = steps.filter((s) => s.done).length;
  const [leaving, setLeaving] = useState(false);
  return (
    <Drawer open={open} onClose={onClose} title="Judge wallet">
      <div className="flex items-center gap-3 rounded-xl bg-cream p-4 text-cream-ink">
        <Hanko size={44} />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-[15px]">Real money on Zcash mainnet</span>
          <span className="text-[13px] text-cream-ink/65">
            Shared by every judge · {done} of {steps.length} done
          </span>
        </div>
      </div>
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const body = (
            <>
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-[12px]",
                  s.done ? "bg-up text-black" : "bg-surface-2 text-ink-2",
                )}
              >
                {s.done ? <Check size={14} /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cx("font-medium text-[14px]", s.done && "text-ink-2")}>{s.title}</span>
                <span className="text-[12px] text-muted">{s.detail}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-muted" />
            </>
          );
          const row = "flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-2";
          return (
            <li key={s.id}>
              {"href" in s.go ? (
                <Link href={s.go.href} onClick={onClose} className={row}>
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={s.go.onClick} className={row}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2 border-hairline border-t pt-4 text-[13px]">
        <a href="https://mitoshi.xyz" className="font-medium text-accent hover:underline">
          Make your own wallet at mitoshi.xyz
        </a>
        {leaving ? (
          <span className="flex items-center gap-3">
            <span className="text-ink-2">This browser forgets the wallet.</span>
            <button type="button" onClick={() => void leaveDesk()} className="font-medium text-down hover:underline">
              Give it back
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setLeaving(true)}
            className="self-start text-muted hover:text-ink hover:underline"
          >
            Give this wallet back
          </button>
        )}
      </div>
    </Drawer>
  );
}

/** The top line's judge chip, on judge.mitoshi.xyz only: the path through the judges' wallet. */
export function DeskChip() {
  const n = useJudgeDesk();
  const open = usePathOpen();
  const steps = usePath(() => setPathOpen(false));
  if (n === null) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <>
      <button
        type="button"
        onClick={openJudgePath}
        aria-label={`Judge wallet: ${done} of ${steps.length} steps done`}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-accent/50 bg-accent-wash pr-3 pl-1.5 font-semibold text-[13px] text-ink hover:border-accent md:h-10"
      >
        <Hanko size={28} />
        <span>Judge</span>
        <span className="num text-[12px] text-ink-2">
          {done}/{steps.length}
        </span>
      </button>
      <JudgeSheet open={open} onClose={() => setPathOpen(false)} />
    </>
  );
}
