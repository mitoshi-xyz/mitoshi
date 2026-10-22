"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Drawer } from "@/kit";
import { applyTheme, currentTheme } from "../theme/theme";
import { MoneyPlate } from "./money-plate";
import { PLACES } from "./places";

/** More: every place as a tile, the money plate, and the theme (the phone's way to everything). */
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
