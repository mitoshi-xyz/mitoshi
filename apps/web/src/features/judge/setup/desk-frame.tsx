"use client";

import { useEffect, useRef, useState } from "react";
import { DESK_READY_ZAT, ZEC_NETWORK } from "@/constants";
import { prepareWallet, startJobs, venueAddress } from "../../private-wallets/jobs";
import { currentRegistry, loadRegistry, useRegistry } from "../../private-wallets/registry-store";
import { claimTab } from "../../vault/tab-lock";
import {
  bootWallet,
  createWallet,
  deviceSeed,
  freshAddress,
  money,
  newPhrase,
  useWallet,
  vaultRecord,
  walletState,
} from "../../wallet/wallet-store";
import { DESK_VERSION, type DeskBundle, sealDesk, toBase64 } from "../desk";
import { setupSlot } from "../slot";
import { type FromDesk, SETUP_CHANNEL, type ToDesk } from "./protocol";

const STATUS_MS = 3_000;

function deskNumber(): number | null {
  const n = Number(setupSlot()?.replace(/^desk-/, ""));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The desk's ready Hyperliquid wallet (the newest Hyperliquid wallet it made). */
const hyperliquidWallet = () => currentRegistry().wallets.find((w) => w.venue === "hyperliquid");

/**
 * The Hyperliquid address the gate looks a desk up by. Testnet has no NEAR route, so a test desk seals without a funded
 * wallet, under the address its first Hyperliquid wallet would have: the opening flow can still be tried end to end.
 */
async function deskAddress(): Promise<string | null> {
  const hl = hyperliquidWallet();
  if (hl?.status === "ready") return hl.address;
  return ZEC_NETWORK === "test" ? venueAddress(await deviceSeed(), "hyperliquid", 0) : null;
}

async function seal(n: number, key: string): Promise<FromDesk> {
  const address = await deskAddress();
  if (!address) return { kind: "failed", n, error: "its Hyperliquid wallet is not ready yet" };
  const [mnemonic, walletdb] = await Promise.all([vaultRecord("mnemonic"), vaultRecord("walletdb")]);
  if (!mnemonic || !walletdb) return { kind: "failed", n, error: "the vault has no wallet yet" };
  const bundle: DeskBundle = {
    v: DESK_VERSION,
    n,
    network: ZEC_NETWORK,
    mnemonic: new TextDecoder().decode(mnemonic),
    walletdb: toBase64(walletdb),
    registry: currentRegistry(),
  };
  return { kind: "sealed", n, file: toBase64(await sealDesk(key, bundle)), hyperliquid: address };
}

/**
 * One desk being set up, inside the console's page: a wallet of its own (its frame's vault), made on first open, that
 * reports what it holds, funds its Hyperliquid wallet when the console asks (an ordinary funding at a random moment),
 * and seals itself into a desk file.
 */
export function DeskFrame() {
  const w = useWallet();
  const registry = useRegistry();
  const address = useRef<string | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  // Read after mount: the frame's name is only there in the browser, and the static page must hydrate the same.
  const [n, setN] = useState<number | null>(null);
  useEffect(() => setN(deskNumber()), []);

  useEffect(() => {
    if (n === null) return;
    void claimTab().then((mine) => {
      if (!mine) return;
      void bootWallet();
      loadRegistry().then(startJobs, () => undefined);
    });
    const ch = new BroadcastChannel(SETUP_CHANNEL);
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<ToDesk>) => {
      const m = e.data;
      if (m.kind === "fund" && m.n === n) {
        const hl = hyperliquidWallet();
        if (hl && hl.status !== "failed") return;
        prepareWallet("hyperliquid", DESK_READY_ZAT).catch((err: unknown) =>
          ch.postMessage({ kind: "failed", n, error: err instanceof Error ? err.message : String(err) }),
        );
      }
      if (m.kind === "seal" && m.n === n) {
        seal(n, m.key).then(
          (out) => ch.postMessage(out),
          (err: unknown) =>
            ch.postMessage({ kind: "failed", n, error: err instanceof Error ? err.message : String(err) }),
        );
      }
    };
    return () => ch.close();
  }, [n]);

  // A desk opened for the first time makes its own wallet (new words, a birthday at today's tip).
  useEffect(() => {
    if (w.phase === "empty") void createWallet(newPhrase(), false);
    if (w.phase === "ready" && address.current === null) {
      freshAddress().then(
        (a) => {
          address.current = a;
        },
        () => undefined,
      );
    }
  }, [w.phase]);

  useEffect(() => {
    if (n === null) return;
    const report = () => {
      const s = walletState();
      const m = money(s.summary?.balance);
      const hl = hyperliquidWallet();
      channel.current?.postMessage({
        kind: "status",
        n,
        phase: s.phase,
        address: address.current,
        spendable: m.spendable,
        confirming: m.confirming,
        resting: m.resting,
        ready: hl
          ? { status: hl.status, address: hl.address, sizeZat: hl.sizeZat, ...(hl.error ? { error: hl.error } : {}) }
          : null,
        tip: s.summary?.tip ?? null,
        error: s.error ?? s.syncError,
      } satisfies FromDesk);
    };
    report();
    const t = setInterval(report, STATUS_MS);
    return () => clearInterval(t);
  }, [n, w, registry]);

  return (
    <p className="p-2 text-[11px] text-muted">
      Desk {n ?? "?"} · {w.phase}
    </p>
  );
}
