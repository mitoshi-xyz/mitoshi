/** Up to this span on screen (36 h) the axis reads clock times ("14:30"). */
const CLOCK_SPAN_MS = 129_600_000;
/** Up to this span (300 days) it reads days ("Oct 16"); past it, months ("Oct '25"). */
const DAY_SPAN_MS = 25_920_000_000;

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

const two = (n: number) => String(n).padStart(2, "0");
const clock = (d: Date) => `${two(d.getHours())}:${two(d.getMinutes())}`;
const year = (d: Date) => `'${String(d.getFullYear()).slice(-2)}`;

/**
 * A time as coarse as the span on screen needs. The axis gets the short form; the crosshair (`precise`) adds what
 * the axis leaves out, so a week of hourly points reads "Oct 16" below and "Oct 16 14:00" under the pointer.
 */
export function defaultTime(ms: number, spanMs: number, precise: boolean): string {
  const d = new Date(ms);
  if (spanMs <= CLOCK_SPAN_MS) return clock(d);
  if (spanMs <= DAY_SPAN_MS) return precise ? `${DAY.format(d)} ${clock(d)}` : DAY.format(d);
  return precise ? `${DAY.format(d)} ${year(d)}` : `${MONTH.format(d)} ${year(d)}`;
}

/** The time a set of bars covers, first to last. */
export function spanOf(bars: readonly { t: number }[]): number {
  const first = bars[0];
  const last = bars.at(-1);
  return first && last ? last.t - first.t : 0;
}
