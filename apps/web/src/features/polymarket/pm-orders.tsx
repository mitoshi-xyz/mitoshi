"use client";

import type { PrivateWallet } from "@mitoshi/engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { cx } from "@/kit";
import { pmAccount } from "./pm-account";

const ORDERS_REFRESH_MS = 20_000;
const PCT = 100;
const SHARE_DIGITS = 2;

/** A wallet's resting orders on Polymarket, each cancellable. */
export function PmOrders({ wallet }: { wallet: PrivateWallet }) {
  const queries = useQueryClient();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const orders = useQuery({
    queryKey: ["polymarket", "orders", wallet.id],
    // Only for a wallet already set up: opening one that is not would deploy it just to read.
    enabled: Boolean(wallet.prepared),
    refetchInterval: ORDERS_REFRESH_MS,
    queryFn: async () => (await pmAccount(wallet)).openOrders(),
  });
  if (!orders.data?.length) return null;
  return (
    <section className="flex flex-col gap-2 border-hairline border-t pt-3">
      <h3 className="type-label text-muted">Open orders</h3>
      <ul className="flex flex-col gap-1.5">
        {orders.data.map((o) => (
          <li key={o.id} className="flex items-center gap-2 text-[13px]">
            <span
              className={cx(
                "rounded px-1.5 py-0.5 text-[10px] uppercase",
                o.side === "buy" ? "bg-up-wash text-up" : "bg-down-wash text-down",
              )}
            >
              {o.side}
            </span>
            <span className="num">
              {(o.size - o.filled).toFixed(SHARE_DIGITS)} at {Math.round(o.price * PCT)}¢
            </span>
            <button
              type="button"
              disabled={cancelling === o.id}
              onClick={async () => {
                setCancelling(o.id);
                try {
                  await (await pmAccount(wallet)).cancel(o.id);
                } finally {
                  setCancelling(null);
                  void queries.invalidateQueries({ queryKey: ["polymarket", "orders", wallet.id] });
                }
              }}
              className="ml-auto inline-flex items-center gap-1 text-[12px] text-ink-2 hover:text-down disabled:opacity-50"
            >
              <X size={12} /> {cancelling === o.id ? "Cancelling…" : "Cancel"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
