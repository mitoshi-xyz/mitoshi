/** Display formatting shared by the market screens. */

const PCT = 100;
const PCT_DECIMALS = 2;
const FUNDING_DECIMALS = 4;
const SMALL_PRICE = 1;
const TINY_PRICE = 0.01;
const PRICE_SIG_DIGITS = 5;
const LARGE_PRICE = 1000;
const LARGE_PRICE_DECIMALS = 1;
const SMALL_PRICE_DECIMALS = 4;

export function price(px: number): string {
  if (!Number.isFinite(px)) return "–";
  if (px >= SMALL_PRICE)
    return px.toLocaleString("en-US", {
      maximumFractionDigits: px >= LARGE_PRICE ? LARGE_PRICE_DECIMALS : SMALL_PRICE_DECIMALS,
    });
  if (px >= TINY_PRICE) return px.toFixed(PRICE_SIG_DIGITS);
  return px.toPrecision(PRICE_SIG_DIGITS);
}

export function usd(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
}

export function compactUsd(v: number): string {
  if (!Number.isFinite(v)) return "–";
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

export function pct(fraction: number, digits = PCT_DECIMALS): string {
  if (!Number.isFinite(fraction)) return "–";
  const s = (fraction * PCT).toFixed(digits);
  return `${fraction > 0 ? "+" : ""}${s}%`;
}

/** Hourly funding as a percentage with enough digits to be meaningful. */
export function funding(hourly: number): string {
  return pct(hourly, FUNDING_DECIMALS);
}

export const upDown = (v: number) => (v > 0 ? "text-up" : v < 0 ? "text-down" : "text-ink-2");
