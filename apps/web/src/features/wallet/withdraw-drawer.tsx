"use client";

import { checkWithdrawal, type LeakReport, type Payout } from "@mitoshi/engine";
import { ZAT_PER_ZEC } from "@mitoshi/zwallet";
import { ClipboardPaste, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ZEC_NETWORK } from "@/constants";
import { cue, cx, Drawer, SlideToConfirm, TxSteps, Wait } from "@/kit";
import { LeakMeter } from "../privacy/leak-meter";
import { useRegistry } from "../private-wallets/registry-store";
import { previewSend, send, useWallet } from "./wallet-store";

const UNIT = ZEC_NETWORK === "main" ? "ZEC" : "TAZ";
const ZEC_DIGITS = 8;
const REVIEW_DEBOUNCE_MS = 500;
const FEE_RESERVE_ZAT = 15_000;
const PROOF_SECONDS = 20;
const TXID_HEAD = 12;

/** The core's words when a send needs more than is spendable; the fee is the difference. */
const INSUFFICIENT = /Insufficient balance \(have (\d+), need (\d+) including fee\)/;

const zec = (zat: number) => (zat / ZAT_PER_ZEC).toFixed(ZEC_DIGITS).replace(/\.?0+$/, "");

type Kind = "shielded" | "public" | "sapling" | "wrong-network" | "invalid" | "empty";

/** What kind of Zcash address this is, for the network the app runs on. */
function classify(a: string): Kind {
  const s = a.trim();
  if (!s) return "empty";
  const main = ZEC_NETWORK === "main";
  if (main ? s.startsWith("u1") : s.startsWith("utest1")) return "shielded";
  if (main ? /^(t1|t3|tex1)/.test(s) : /^(tm|t2|textest1)/.test(s)) return "public";
  if (main ? s.startsWith("zs1") : s.startsWith("ztestsapling")) return "sapling";
  if (/^(u1|utest1|t1|t3|tm|zs1|ztestsapling|tex1)/.test(s)) return "wrong-network";
  return "invalid";
}

const KIND_WORDS: Record<Kind, string> = {
  shielded: "Shielded address: the amount and both ends stay private",
  public: "Transparent address: the amount and the recipient will be public",
  sapling: "Sapling addresses are not supported; ask for a unified address (u1…)",
  "wrong-network": ZEC_NETWORK === "main" ? "That is a testnet address" : "That is a mainnet address",
  invalid: "Not a Zcash address",
  empty: "",
};

type Step = { kind: "form" } | { kind: "proving" } | { kind: "sent"; txid: string } | { kind: "failed"; error: string };

/** Withdraw: send ZEC out to your own wallet (or anyone), with the leak meter watching the amount. */
export function WithdrawDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useWallet();
  const registry = useRegistry();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<number | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "form" });

  useEffect(() => {
    if (open) {
      setStep({ kind: "form" });
      setFee(null);
    }
  }, [open]);

  const b = w.summary?.balance;
  const spendable = b ? b.ironwood.spendable + b.orchard.spendable : 0;
  const resting = b ? b.ironwood.locked + b.orchard.locked : 0;
  const kind = classify(to);
  const zat = Math.round((Number(amount) || 0) * ZAT_PER_ZEC);
  const sendable = kind === "shielded" || kind === "public";

  useEffect(() => {
    setFee(null);
    setFeeError(null);
    if (!sendable || zat <= 0) return;
    const t = setTimeout(() => {
      previewSend(to.trim(), zat).then(
        (p) => setFee(p.fee),
        (e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          const short = INSUFFICIENT.exec(msg);
          // Short of funds is not an error in the address or amount: the fee is still known.
          if (short) setFee(Number(short[2]) - zat);
          else setFeeError(msg);
        },
      );
    }, REVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [to, zat, sendable]);

  const payouts: Payout[] = useMemo(
    () =>
      registry.wallets.flatMap((x) =>
        x.swaps
          .filter((s) => s.kind === "return" && s.status === "SUCCESS" && s.settledOut)
          .map((s) => ({ zat: Number(s.settledOut), at: s.updatedAt })),
      ),
    [registry.wallets],
  );
  const leak: LeakReport | null =
    sendable && zat > 0
      ? checkWithdrawal({ amountZat: zat, shielded: kind === "shielded", now: Date.now(), payouts })
      : null;
  const tooMuch = zat + (fee ?? 0) > spendable;

  async function confirm() {
    setStep({ kind: "proving" });
    try {
      const r = await send(to.trim(), zat);
      setStep({ kind: "sent", txid: r.txid });
      cue("send");
      setAmount("");
    } catch (e) {
      setStep({ kind: "failed", error: e instanceof Error ? e.message : String(e) });
      cue("error");
    }
  }

  const sent = step.kind === "sent" ? w.history.find((h) => h.txid === step.txid) : undefined;
  return (
    <Drawer open={open} onClose={onClose} title={`Withdraw ${UNIT}`}>
      {step.kind === "form" ? (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="type-label text-muted">To</span>
            <span className="relative">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                spellCheck={false}
                placeholder={ZEC_NETWORK === "main" ? "u1… your Zodl address" : "utest1…"}
                className="h-12 w-full rounded-lg border border-hairline bg-bg px-3 pr-11 font-mono text-[13px] outline-none focus:border-strong"
              />
              <button
                type="button"
                aria-label="Paste"
                onClick={() => void navigator.clipboard.readText().then(setTo, () => undefined)}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-ink-2 hover:bg-surface-2"
              >
                <ClipboardPaste size={16} />
              </button>
            </span>
            {kind !== "empty" ? (
              <span
                className={cx(
                  "flex items-center gap-1.5 text-[12px]",
                  kind === "shielded" ? "text-up" : kind === "public" ? "text-warning" : "text-down",
                )}
              >
                {kind === "shielded" ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                {KIND_WORDS[kind]}
              </span>
            ) : null}
          </label>
          <label className="flex flex-col gap-2">
            <span className="flex items-baseline justify-between">
              <span className="type-label text-muted">Amount</span>
              <button
                type="button"
                onClick={() => setAmount(zec(Math.max(0, spendable - FEE_RESERVE_ZAT)))}
                className="num text-[12px] text-accent hover:underline"
              >
                Max {zec(spendable)} {UNIT}
              </button>
            </span>
            <span className="relative">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="h-12 w-full rounded-lg border border-hairline bg-bg px-3 font-mono text-[18px] outline-none focus:border-strong"
              />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">{UNIT}</span>
            </span>
          </label>
          <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg bg-bg/60 p-3 text-[13px]">
            <dt className="text-ink-2">Network fee</dt>
            <dd className="num text-right">{fee !== null ? `${zec(fee)} ${UNIT}` : zat > 0 && sendable ? "…" : "–"}</dd>
            <dt className="text-ink-2">Arrives</dt>
            <dd className="num text-right">{zat > 0 ? `${zec(zat)} ${UNIT}` : "–"}</dd>
          </dl>
          {leak ? <LeakMeter report={leak} /> : null}
          {feeError ? <p className="text-[12px] text-down">{feeError}</p> : null}
          {tooMuch && zat > 0 ? (
            <p className="text-[12px] text-warning">
              {spendable === 0 && resting === 0
                ? `Nothing to send yet: deposit ${UNIT} first.`
                : resting > 0
                  ? `You can send ${zec(spendable)} ${UNIT} now. Another ${zec(resting)} ${UNIT} is resting and frees up within hours.`
                  : `That is more than your ${zec(spendable)} ${UNIT}, once the network fee is added.`}
            </p>
          ) : null}
          <SlideToConfirm
            label="Slide to send privately"
            disabled={!sendable || zat <= 0 || fee === null || tooMuch}
            onConfirm={() => void confirm()}
          />
        </div>
      ) : step.kind === "failed" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-down/30 bg-down-wash p-4">
          <p className="font-semibold text-down">Nothing was sent. Your ZEC is where it was.</p>
          <p className="text-[13px] text-ink-2">{step.error}</p>
          <button
            type="button"
            onClick={() => setStep({ kind: "form" })}
            className="self-start text-[13px] text-accent hover:underline"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <TxSteps
            steps={[
              {
                label: "Making the private proof",
                state: step.kind === "proving" ? "active" : "done",
                detail:
                  step.kind === "proving" ? (
                    <Wait verb="Proving in this browser" expectSeconds={PROOF_SECONDS} />
                  ) : undefined,
              },
              {
                label: "Sent privately",
                state: step.kind === "sent" ? "done" : "pending",
                detail: step.kind === "sent" ? `${step.txid.slice(0, TXID_HEAD)}…` : undefined,
              },
              {
                label: sent?.minedHeight ? "Confirmed" : "Confirming in a block",
                state: step.kind !== "sent" ? "pending" : sent?.minedHeight ? "done" : "active",
              },
            ]}
          />
          {step.kind === "sent" ? (
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-full border border-strong font-medium text-sm hover:bg-surface-2"
            >
              Done
            </button>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
