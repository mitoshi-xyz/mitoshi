"use client";

import { Menu, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { applyTheme, currentTheme } from "../theme/theme";
import { MoneyPlate, NetworkStamp } from "./money-plate";
import { PLACES, placeFor } from "./places";
import { Seal } from "./seal";

const STROKE = 2;
const STROKE_HERE = 2.5;

/** The floating rail: the seal, the money plate, the places (keys 1–6), and the theme at the foot. */
export function Rail({ onMore }: { onMore: () => void }) {
  const path = usePathname();
  const here = placeFor(path);
  const index = here ? PLACES.indexOf(here) : -1;
  const [light, setLight] = useState(false);
  useEffect(() => setLight(currentTheme() === "light"), []);

  return (
    <aside className="mt-rail" aria-label="Mitoshi">
      <div className="flex flex-col items-center gap-4 xl:items-stretch">
        <Link href="/markets" className="flex items-center gap-2.5 rounded-lg xl:pl-1">
          <Seal size={38} />
          <span className="mt-wide">
            <span className="font-heading font-extrabold text-[17px] tracking-[0.04em]">MITOSHI</span>{" "}
            <span className="font-stamp text-[15px] text-ink-2">見通し</span>
          </span>
        </Link>
        <div className="mt-wide">
          <MoneyPlate />
        </div>
        <div className="mt-narrow">
          <NetworkStamp />
        </div>
      </div>
      <nav className="mt-nav" aria-label="Places">
        <span
          aria-hidden
          className="mt-nav-pill"
          style={{ "--i": index, opacity: index < 0 ? 0 : 1 } as React.CSSProperties}
        />
        {PLACES.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            title={`${p.name} · ${p.description}`}
            aria-current={here?.id === p.id ? "page" : undefined}
            className="mt-nav-item"
          >
            <p.icon size={22} strokeWidth={here?.id === p.id ? STROKE_HERE : STROKE} className="shrink-0" />
            <span className="mt-nav-label">{p.name}</span>
            <span className="mt-nav-key">{p.key}</span>
          </Link>
        ))}
      </nav>
      <button
        type="button"
        onClick={onMore}
        title="More · money, privacy, settings, status, docs"
        className="mt-nav-item"
      >
        <Menu size={22} strokeWidth={STROKE} className="shrink-0" />
        <span className="mt-nav-label">More</span>
      </button>
      <div className="mt-auto flex flex-col items-center gap-3 xl:flex-row xl:pl-1">
        <button
          type="button"
          aria-label={light ? "Dark theme" : "Light theme"}
          onClick={() => {
            applyTheme(light ? "dark" : "light");
            setLight(!light);
          }}
          className="flex size-10 items-center justify-center rounded-full bg-rail-active/60 text-ink-2 hover:text-ink"
        >
          {light ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <span className="mt-wide text-[13px] text-muted">Private by design</span>
      </div>
    </aside>
  );
}
