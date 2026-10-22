import { alpha, type Colors } from "./colors";
import type { Bar } from "./types";

/** Candles (with volume), the history line, time labels and the crosshair reading. */

const VOLUME_ALPHA = 0.22;
const AREA_ALPHA = 0.2;
const LINE_W = 2;
const HALF_PX = 0.5;
const TIME_FONT = 11;
const DASH = 3;
const CROSS_DASH = [DASH, DASH];
const READOUT_X = 10;
const READOUT_Y = 8;
const PCT = 100;
const PCT_DIGITS = 2;

export interface Frame {
  ctx: CanvasRenderingContext2D;
  colors: Colors;
  bars: Bar[];
  xOf: (i: number) => number;
  yOf: (p: number) => number;
  spacing: number;
  plotW: number;
  plotH: number;
}

export function paintCandles(f: Frame, bodyRatio: number, volumeShare: number) {
  const { ctx, colors, bars, xOf, yOf, spacing, plotH } = f;
  const vMax = Math.max(1, ...bars.map((b) => b.v ?? 0));
  const body = spacing * bodyRatio;
  bars.forEach((b, i) => {
    const x = xOf(i);
    const color = b.c >= b.o ? colors.up : colors.down;
    if (b.v) {
      const vh = (b.v / vMax) * plotH * volumeShare;
      ctx.globalAlpha = VOLUME_ALPHA;
      ctx.fillStyle = color;
      ctx.fillRect(x - body / 2, plotH - vh, body, vh);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + HALF_PX, yOf(b.h));
    ctx.lineTo(Math.round(x) + HALF_PX, yOf(b.l));
    ctx.stroke();
    const y1 = yOf(Math.max(b.o, b.c));
    const y2 = yOf(Math.min(b.o, b.c));
    ctx.fillStyle = color;
    ctx.fillRect(x - body / 2, y1, body, Math.max(1, y2 - y1));
  });
}

export function paintHistoryLine(f: Frame, top: number, bottom: number) {
  const { ctx, colors, bars, xOf, yOf } = f;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, alpha(colors.accent, AREA_ALPHA));
  grad.addColorStop(1, alpha(colors.accent, 0));
  ctx.beginPath();
  for (const [i, b] of bars.entries()) {
    if (i === 0) ctx.moveTo(xOf(i), yOf(b.c));
    else ctx.lineTo(xOf(i), yOf(b.c));
  }
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = LINE_W;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineTo(xOf(bars.length - 1), bottom);
  ctx.lineTo(xOf(0), bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

export function paintTimeLabels(f: Frame, timeH: number, everyPx: number, formatTime: (ms: number) => string) {
  const { ctx, colors, bars, xOf, spacing, plotH } = f;
  ctx.fillStyle = colors.muted;
  ctx.font = `500 ${TIME_FONT}px ${colors.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const every = Math.max(1, Math.round(everyPx / spacing));
  bars.forEach((b, i) => {
    if ((bars.length - 1 - i) % every === 0) ctx.fillText(formatTime(b.t), xOf(i), plotH + timeH / 2);
  });
}

/** Cross lines at the pointer and the reading of the bar under it. Returns the bar, if any. */
export function paintCrosshair(
  f: Frame,
  hover: { x: number; y: number },
  candles: boolean,
  format: (p: number) => string,
  formatTime: (ms: number) => string,
): Bar | null {
  const { ctx, colors, bars, xOf, spacing, plotW, plotH } = f;
  const i = Math.round(bars.length - HALF_PX - (plotW - hover.x) / spacing);
  const b = bars[Math.min(bars.length - 1, Math.max(0, i))];
  if (!b) return null;
  const x = xOf(bars.indexOf(b));
  ctx.save();
  ctx.setLineDash(CROSS_DASH);
  ctx.strokeStyle = colors.faint;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, plotH);
  ctx.moveTo(0, hover.y);
  ctx.lineTo(plotW, hover.y);
  ctx.stroke();
  ctx.restore();
  const change = b.o ? b.c / b.o - 1 : 0;
  const pct = `${change >= 0 ? "+" : ""}${(change * PCT).toFixed(PCT_DIGITS)}%`;
  const text = candles
    ? `O ${format(b.o)}  H ${format(b.h)}  L ${format(b.l)}  C ${format(b.c)}  ${pct}`
    : `${formatTime(b.t)}  ${format(b.c)}`;
  ctx.font = `500 ${TIME_FONT}px ${colors.mono}`;
  ctx.fillStyle = colors.ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(text, READOUT_X, READOUT_Y);
  return b;
}
