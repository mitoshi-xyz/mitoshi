"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Drawer } from "@/kit";
import { applyTheme, currentTheme } from "../theme/theme";
import { MoneyPlate } from "./money-plate";
import { PAGES, type Page, PLACES } from "./places";

function Group({ title, items, onClose }: { title: string; items: readonly Page[]; onClose: () => void }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="type-label text-muted">{title}</h3>
      <div className="flex flex-col overflow-hidden rounded-lg bg-surface-2">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            onClick={onClose}
            className="flex items-center gap-3 border-hairline border-b px-3.5 py-3 text-[14px] last:border-b-0 hover:bg-surface-3"
          >
            <i.icon size={17} className="text-ink-2" />
            {i.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

/** More: every place as a tile, the money plate, money and Mitoshi links, and the theme (the phone's way to everything). */
export function More({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [light, setLight] = useState(false);
  useEffect(() => setLight(currentTheme() === "light"), []);
  return (
    <Drawer open={open} onClose={onClose} title="Mitoshi 見通し">
      <MoneyPlate />
      <div className="grid grid-cols-3 gap-2">
        {PLACES.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            onClick={onClose}
            className="flex flex-col items-center gap-2 rounded-lg bg-surface-2 px-2 py-4 text-[13px] hover:bg-surface-3"
          >
            <p.icon size={22} />
            {p.name}
          </Link>
        ))}
      </div>
      <Group title="Your money" items={PAGES.filter((p) => p.group === "money")} onClose={onClose} />
      <Group title="Mitoshi" items={PAGES.filter((p) => p.group === "mitoshi")} onClose={onClose} />
      <button
        type="button"
        onClick={() => {
          applyTheme(light ? "dark" : "light");
          setLight(!light);
        }}
        className="flex items-center justify-center gap-2 rounded-full border border-hairline py-2.5 text-sm text-ink-2"
      >
        {light ? <Moon size={16} /> : <Sun size={16} />} {light ? "Dark theme" : "Cream theme"}
      </button>
    </Drawer>
  );
}
