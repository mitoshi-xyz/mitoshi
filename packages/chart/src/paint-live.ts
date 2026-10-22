import { alpha, type Colors } from "./colors";

/** The live line's painter: area, line, the fading tail, the breathing head and the guide to the price pill. */

const AREA_ALPHA = 0.22;
const LINE_W = 2;
const HEAD_R = 4;
const PULSE_GROW = 10;
const PULSE_ALPHA = 0.35;
const DASH = 3;
const GUIDE_DASH = [DASH, DASH];
const GUIDE_ALPHA = 0.6;

export interface Point {
  x: number;
  y: number;
}

export function paintLiveLine(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  points: Point[],
  plotW: number,
  height: number,
  tailFraction: number,
): Point | null {
  const head = points.at(-1);
  const first = points[0];
  if (!head || !first) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, alpha(colors.accent, AREA_ALPHA));
  grad.addColorStop(1, alpha(colors.accent, 0));
  ctx.beginPath();
  for (const [k, p] of points.entries()) {
    if (k === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.lineWidth = LINE_W;
  ctx.strokeStyle = colors.accent;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.lineTo(head.x, height);
  ctx.lineTo(first.x, height);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  // The fading tail on the left.
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const fade = ctx.createLinearGradient(0, 0, plotW * tailFraction, 0);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, plotW * tailFraction, height);
  ctx.restore();
  return head;
}

/** The head: a dot with a ring that breathes, and a dashed guide to the axis. */
export function paintHead(
  ctx: CanvasRenderingContext2D,
  colors: Colors,
  head: Point,
  plotW: number,
  pulsePhase: number,
) {
  ctx.beginPath();
  ctx.arc(head.x, head.y, HEAD_R + pulsePhase * PULSE_GROW, 0, Math.PI * 2);
  ctx.fillStyle = alpha(colors.accent, (1 - pulsePhase) * PULSE_ALPHA);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(head.x, head.y, HEAD_R, 0, Math.PI * 2);
  ctx.fillStyle = colors.accent;
  ctx.fill();
  paintGuide(ctx, colors, head.y, head.x, plotW);
}

/** A dashed accent line from x0 to the axis at height y (the live price's level). */
export function paintGuide(ctx: CanvasRenderingContext2D, colors: Colors, y: number, x0: number, plotW: number) {
  ctx.save();
  ctx.setLineDash(GUIDE_DASH);
  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = GUIDE_ALPHA;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(plotW, y);
  ctx.stroke();
  ctx.restore();
}
