import type { Colors } from "./colors";
import type { Levels } from "./types";

/** Drawing primitives the chart engine composes (each draws on a context already scaled to CSS pixels). */

const DOT_SIZE = 1.2;
const WATERMARK_ALPHA = 0.05;
const AXIS_FONT = 11;
const AXIS_GAP = 8;
const PILL_GAP = 4;
const PILL_H = 20;
const PILL_PAD = 6;
const PILL_RADIUS = 6;
const LEVEL_ALPHA = 0.8;
const DASH_ON = 5;
const DASH_OFF = 4;
const LEVEL_DASH = [DASH_ON, DASH_OFF];
const LEVEL_FONT = 10;
const LEVEL_X = 8;
const LEVEL_LIFT = 3;
const HALF_PX = 0.5;

export function paintDots(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  width: number,
  height: number,
  spacing: number,
  drift: number,
) {
  ctx.fillStyle = colors.hairline;
  for (let x = spacing - drift; x < width; x += spacing) {
    for (let y = spacing / 2; y < height; y += spacing) ctx.fillRect(x, y, DOT_SIZE, DOT_SIZE);
  }
}

export function paintWatermark(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  text: string,
  width: number,
  height: number,
  size: number,
) {
  ctx.save();
  ctx.globalAlpha = WATERMARK_ALPHA;
  ctx.fillStyle = colors.ink;
  ctx.font = `700 ${size}px ${colors.stamp}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
  ctx.restore();
}

/** Horizontal price lines with their labels in the axis column. */
export function paintAxis(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  plotW: number,
  lo: number,
  hi: number,
  lines: number,
  yOf: (p: number) => number,
  format: (p: number) => string,
) {
  ctx.font = `500 ${AXIS_FONT}px ${colors.mono}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= lines; i++) {
    const p = lo + ((hi - lo) * i) / lines;
    const y = Math.round(yOf(p)) + HALF_PX;
    ctx.strokeStyle = colors.hairline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
    ctx.stroke();
    ctx.fillStyle = colors.muted;
    ctx.fillText(format(p), plotW + AXIS_GAP, y);
  }
}

/** How wide the axis must be for a price label (the pill's bold text, its padding and gap). */
export function axisWidthFor(ctx: CanvasRenderingContext2D, colors: Colors, text: string): number {
  ctx.font = `600 ${AXIS_FONT}px ${colors.mono}`;
  return Math.ceil(ctx.measureText(text).width + 2 * PILL_PAD + PILL_GAP + AXIS_GAP);
}

/** A price riding the axis on a rounded pill. */
export function paintPill(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  plotW: number,
  axisW: number,
  y: number,
  text: string,
  fill: string,
  ink: string,
) {
  ctx.font = `600 ${AXIS_FONT}px ${colors.mono}`;
  const tw = ctx.measureText(text).width;
  const x = plotW + PILL_GAP;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y - PILL_H / 2, Math.min(axisW - PILL_PAD, tw + 2 * PILL_PAD), PILL_H, PILL_RADIUS);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + PILL_PAD, y + HALF_PX);
}

/** Entry (solid), take profit, stop loss and liquidation (dashed), each labelled. */
export function paintLevels(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  levels: Levels,
  plotW: number,
  plotH: number,
  yOf: (p: number) => number,
  format: (p: number) => string,
) {
  const rows: [keyof Levels, string, string][] = [
    ["entry", colors.ink, "Entry"],
    ["takeProfit", colors.up, "TP"],
    ["stopLoss", colors.down, "SL"],
    ["liquidation", colors.warning, "Liq"],
  ];
  for (const [key, color, label] of rows) {
    const p = levels[key];
    if (p === null || p === undefined || !Number.isFinite(p)) continue;
    const y = yOf(p);
    if (y < 0 || y > plotH) continue;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = LEVEL_ALPHA;
    ctx.setLineDash(key === "entry" ? [] : LEVEL_DASH);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(plotW, y);
    ctx.stroke();
    ctx.restore();
    ctx.font = `600 ${LEVEL_FONT}px ${colors.mono}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${label} ${format(p)}`, LEVEL_X, y - LEVEL_LIFT);
  }
}
