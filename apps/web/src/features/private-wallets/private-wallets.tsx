"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, Segmented } from "@/kit";
import { openFund, openPublicView } from "./drawers";
import { canFund } from "./jobs";
import { KeepReady } from "./keep-ready";
import { useRegistry } from "./registry-store";
import { useNow } from "./use-now";
import { WalletCard } from "./wallet-card";

const DONE = new Set<PrivateWallet["status"]>(["retired", "refunded"]);
/** Opening /wallets#new starts a new wallet (the Balance page's "Fund a private wallet"). */
const NEW_HASH = "#new";

/** Private wallets: make one, keep one ready per venue, and follow each wallet from funding to home. */
export function PrivateWallets() {
  const registry = useRegistry();
  const now = useNow();
  const [tab, setTab] = useState<"live" | "done">("live");
  const allowed = canFund();

  useEffect(() => {
    if (window.location.hash !== NEW_HASH) return;
    history.replaceState(null, "", window.location.pathname);
    openFund();
  }, []);

  const live = registry.wallets.filter((w) => !DONE.has(w.status));
  const done = registry.wallets.filter((w) => DONE.has(w.status));
  const shown = tab === "live" ? live : done;
  const ready = live.filter((w) => w.status === "ready").length;
  const moving = live.filter((w) => ["preparing", "funding", "returning"].includes(w.status)).length;

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <h1 className="type-headline-lg">Private wallets</h1>
          <p className="text-ink-2">
            Each trade gets a wallet that has never existed before, funded from your shielded ZEC. Nobody can link two
            of them, or any of them to you.
          </p>
        </div>
        <Button tone="primary" size="lg" icon={<Plus size={18} />} onClick={() => openFund()}>
          New private wallet
        </Button>
      </div>

      {!allowed.ok ? (
        <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-[13px] text-ink-2">{allowed.why}</p>
      ) : null}

      <KeepReady />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={[
              { value: "live", label: `Live · ${live.length}` },
              { value: "done", label: `Done · ${done.length}` },
            ]}
            value={tab}
            onChange={setTab}
          />
          {live.length ? (
            <span className="text-[13px] text-ink-2">
              <span className="num text-up">{ready}</span> ready · <span className="num">{moving}</span> on the move
            </span>
          ) : null}
        </div>
        {shown.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title={tab === "live" ? "No private wallets yet" : "Nothing finished yet"}
            body={
              tab === "live"
                ? "Fund one, or let “Keep one ready” hold one for each venue. Each starts at a random moment and is ready in about 8 minutes."
                : "Wallets that came home or were refunded land here, with their whole story."
            }
            {...(tab === "live" ? { action: { label: "New private wallet", onClick: () => openFund() } } : {})}
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {shown.map((w) => (
              <WalletCard key={w.id} w={w} now={now} onPublic={openPublicView} />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
