"use client";

import { CandlestickChart, LayoutGrid, Menu, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/kit";
import { placeFor } from "./places";
import { Seal } from "./seal";

const STROKE = 2;
const STROKE_HERE = 2.5;

const ITEMS = [
  { id: "markets", name: "Markets", href: "/markets", icon: LayoutGrid },
  { id: "perps", name: "Perps", href: "/trade", icon: CandlestickChart },
  { id: "predict", name: "Predict", href: "/predict", icon: Target },
] as const;

/** The phone dock: Markets, Perps, the seal (your balance), Predict, More. */
export function Dock({ onMore }: { onMore: () => void }) {
  const here = placeFor(usePathname())?.id;
  const item = (i: (typeof ITEMS)[number]) => (
    <Link
      key={i.id}
      href={i.href}
      aria-current={here === i.id ? "page" : undefined}
      className={cx(
        "flex w-[60px] flex-col items-center gap-0.5 text-[11px]",
        here === i.id ? "text-ink" : "text-muted",
      )}
    >
      <i.icon size={21} strokeWidth={here === i.id ? STROKE_HERE : STROKE} />
      {i.name}
    </Link>
  );
  return (
    <nav className="mt-dock" aria-label="Places">
      {item(ITEMS[0])}
      {item(ITEMS[1])}
      <Link
        href="/wallet"
        aria-label="Balance"
        className={cx("-mt-6 rounded-full p-1", here === "balance" ? "shadow-[var(--glow-live)]" : "")}
      >
        <Seal size={50} />
      </Link>
      {item(ITEMS[2])}
      <button
        type="button"
        onClick={onMore}
        className="flex w-[60px] flex-col items-center gap-0.5 text-[11px] text-muted"
      >
        <Menu size={21} />
        More
      </button>
    </nav>
  );
}
