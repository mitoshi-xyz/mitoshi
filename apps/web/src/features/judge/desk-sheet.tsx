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

/** The path through a desk, ticked from what the desk has actually done (and what the judge has looked at). */
function usePath(onGo: () => void): Step[] {
  const registry = useRegistry();
  const seen = useSeenSteps();
  // The desk's first wallet is the one funded before judging; anything after it was made here.
  const first = [...registry.wallets].sort((a, b) => a.createdAt - b.createdAt)[0];
  const traded = registry.wallets.some((w) => (w.trades?.length ?? 0) > 0);
  const made = registry.wallets.length > 1;
  const home = registry.wallets.some((w) => w.status === "returning" || w.status === "retired");
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
      detail: "One wallet, one trade, no history",
      done: seen.includes("public"),
      go: {
        onClick: () => {
          onGo();
          if (first) openPublicView(first.id);
        },
      },
    },
    {
      id: "fund",
      title: "Trade ETH from a brand-new wallet",
      detail: "Funded from shielded ZEC through NEAR · about 8 min",
      done: made,
      go: { href: "/trade#ETH" },
    },
    {
      id: "home",
      title: "Send a wallet home",
      detail: "Back to a fresh shielded address · about 3 min",
      done: home,
      go: { href: "/wallets" },
    },
  ];
}

function JudgeSheet({ open, onClose, n }: { open: boolean; onClose: () => void; n: number }) {
  const steps = usePath(onClose);
  const done = steps.filter((s) => s.done).length;
  const [leaving, setLeaving] = useState(false);
  return (
    <Drawer open={open} onClose={onClose} title={`Judge wallet ${n}`}>
      <div className="flex items-center gap-3 rounded-xl bg-cream p-4 text-cream-ink">
        <Hanko size={44} />
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold text-[15px]">Real money on Zcash mainnet</span>
          <span className="text-[13px] text-cream-ink/65">
            {done} of {steps.length} done
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

/** The top line's desk chip, on judge.mitoshi.xyz only: which desk this is, and the path through it. */
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
        aria-label={`Judge wallet ${n}: ${done} of ${steps.length} steps done`}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-accent/50 bg-accent-wash pr-3 pl-1.5 font-semibold text-[13px] text-ink hover:border-accent md:h-10"
      >
        <Hanko size={28} />
        <span>Judge {n}</span>
        <span className="num text-[12px] text-ink-2">
          {done}/{steps.length}
        </span>
      </button>
      <JudgeSheet open={open} onClose={() => setPathOpen(false)} n={n} />
    </>
  );
}
