import { HEX_RADIX, HEX3, HEX6 } from "./constants";

export interface Colors {
  ink: string;
  muted: string;
  faint: string;
  hairline: string;
  accent: string;
  accentInk: string;
  up: string;
  down: string;
  warning: string;
  surface: string;
  mono: string;
  stamp: string;
}

export function readColors(root: Element = document.documentElement): Colors {
  const css = getComputedStyle(root);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const body = getComputedStyle(document.body);
  return {
    ink: v("--ink", "#fff"),
    muted: v("--muted", "#737373"),
    faint: v("--faint", "#525252"),
    hairline: v("--hairline", "rgba(255,255,255,.1)"),
    accent: v("--accent", "#E04D26"),
    accentInk: v("--accent-ink", "#141210"),
    up: v("--up", "#34D399"),
    down: v("--down", "#FB7185"),
    warning: v("--warning", "#F2994A"),
    surface: v("--surface-2", "#262626"),
    mono: body.getPropertyValue("--font-jetbrains").trim() || "ui-monospace, monospace",
    stamp: body.getPropertyValue("--font-noto-serif-jp").trim() || "serif",
  };
}

/** A token colour at some opacity, as canvas-safe rgba() (canvas does not parse every CSS colour function). */
export function alpha(color: string, a: number): string {
  let hex = color.trim().replace("#", "");
  if (hex.length === HEX3) hex = [...hex].map((ch) => ch + ch).join("");
  if (hex.length !== HEX6 || /[^0-9a-f]/i.test(hex)) return color;
  const n = Number.parseInt(hex, HEX_RADIX);
  return `rgba(${(n >> RED_SHIFT) & BYTE},${(n >> GREEN_SHIFT) & BYTE},${n & BYTE},${a})`;
}

const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const BYTE = 255;
const LARGE = 1000;
const CENT = 0.01;
const DIGITS = { large: 1, unit: 3, small: 5, tiny: 8 } as const;

export const defaultFormat = (p: number) => {
  const digits = p >= LARGE ? DIGITS.large : p >= 1 ? DIGITS.unit : p >= CENT ? DIGITS.small : DIGITS.tiny;
  return p.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export const defaultTime = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
