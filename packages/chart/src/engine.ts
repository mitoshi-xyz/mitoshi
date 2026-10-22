/**
 * Mitoshi's chart engine: one canvas, three ways to look at a market.
 *
 * - "live": the price itself, eased at 60 Hz into a 600-sample ring (about 10 s on screen), centred on a tight range
 *   that follows the price, with a fading tail, a drifting dot field and the price riding a pill on the right.
 * - "line": a history line (a probability, a token's day), extended live.
 * - "candles": OHLC bars with volume; drag to pan, wheel to zoom, a crosshair that reads the bar under it.
 *
 * Every mode draws the position's levels (entry, take profit, stop loss, liquidation). Colours come from the page's
 * CSS variables and follow the theme. The loop runs only while the canvas is on screen and the tab is visible.
 */

import { type Colors, defaultFormat, defaultTime, readColors } from "./colors";
import {
  AXIS_W,
  BODY_RATIO,
  CANDLE_PAD,
  DEFAULT_BARS,
  DOT_DRIFT_PX_PER_FRAME,
  DOT_SPACING,
  EASE_BARS,
  EASE_PRICE,
  EASE_RANGE,
  GRID_LINES,
  HALF_BAR,
  HALF_STEPS,
  MAX_BARS,
  MIN_BARS,
  PAD_TOP,
  PULSE_MS,
  RANGE_FLOOR,
  RANGE_MARGIN,
  RING,
  SETTLED,
  STEP_FRACTION,
  TAIL_FRACTION,
  TIME_H,
  TIME_LABEL_EVERY_PX,
  VOLUME_SHARE,
  WATERMARK_SIZE,
  ZOOM_STEP,
} from "./constants";
import { paintAxis, paintDots, paintLevels, paintPill, paintWatermark } from "./paint";
import { type Frame, paintCandles, paintCrosshair, paintHistoryLine, paintTimeLabels } from "./paint-history";
import { type Point, paintGuide, paintHead, paintLiveLine } from "./paint-live";
import type { Bar, ChartMode, ChartOptions, Levels } from "./types";

export class MarketChart {
  private readonly box: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private mode: ChartMode;
  private colors: Colors;
  private readonly watermark: string;
  private format: (p: number) => string;
  private formatTime: (ms: number) => string;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private visible = true;
  private dirty = true;
  private frame = 0;

  // live
  private ring: Float64Array = new Float64Array(RING);
  private ringLen = 0;
  private ringAt = 0;
  private target = Number.NaN;
  private shown = Number.NaN;
  private center = Number.NaN;
  private half = 0;

  // history (line and candles)
  private bars: Bar[] = [];
  private count = DEFAULT_BARS;
  private offset = 0;
  private yLo = Number.NaN;
  private yHi = Number.NaN;
  private hover: { x: number; y: number } | null = null;
  private drag: { x: number; offset: number } | null = null;

  private levels: Levels = {};
  private readonly cleanups: (() => void)[] = [];

  constructor(box: HTMLElement, options: ChartOptions = {}) {
    this.box = box;
    this.mode = options.mode ?? "candles";
    this.watermark = options.watermark ?? "見通し";
    this.format = options.format ?? defaultFormat;
    this.formatTime = options.formatTime ?? defaultTime;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:pan-y;";
    box.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("no 2D canvas");
    this.ctx = ctx;
    this.colors = readColors();
    this.listen();
    this.resize();
    this.loop();
  }

  // ── public API ──

  setMode(mode: ChartMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.yLo = Number.NaN;
    this.dirty = true;
  }

  setFormat(format: (p: number) => string) {
    this.format = format;
    this.dirty = true;
  }

  setTimeFormat(formatTime: (ms: number) => string) {
    this.formatTime = formatTime;
    this.dirty = true;
  }

  /** A live price tick (live mode eases toward it; other modes move the last bar's close). */
  pushPrice(price: number) {
    if (!Number.isFinite(price)) return;
    this.target = price;
    if (Number.isNaN(this.shown)) {
      this.shown = price;
      this.center = price;
      this.half = price * STEP_FRACTION * HALF_STEPS;
    }
    this.dirty = true;
  }

  setBars(bars: Bar[]) {
    this.bars = [...bars].sort((a, b) => a.t - b.t);
    this.offset = 0;
    this.yLo = Number.NaN;
    const last = this.bars.at(-1);
    if (last) this.pushPrice(last.c);
    this.dirty = true;
  }

  /** A live bar update: replaces the open bar, or starts the next one. */
  pushBar(bar: Bar) {
    const last = this.bars.at(-1);
    if (last && bar.t < last.t) return;
    if (last && bar.t === last.t) this.bars[this.bars.length - 1] = bar;
    else this.bars.push(bar);
    this.pushPrice(bar.c);
    this.dirty = true;
  }

  setLevels(levels: Levels) {
    this.levels = levels;
    this.dirty = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanups) c();
    this.canvas.remove();
  }

  // ── plumbing ──

  private listen() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.box);
    const io = new IntersectionObserver(([e]) => {
      this.visible = Boolean(e?.isIntersecting);
    });
    io.observe(this.box);
    const theme = new MutationObserver(() => {
      this.colors = readColors();
      this.dirty = true;
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-network"] });
    const move = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      this.hover = { x, y: e.clientY - r.top };
      if (this.drag && this.mode !== "live") {
        const spacing = this.plotW() / this.count;
        const maxOffset = Math.max(0, this.bars.length - MIN_BARS);
        this.offset = Math.min(maxOffset, Math.max(0, this.drag.offset + (x - this.drag.x) / spacing));
      }
      this.dirty = true;
    };
    const down = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.drag = { x: e.clientX - r.left, offset: this.offset };
      this.canvas.setPointerCapture(e.pointerId);
    };
    const up = () => {
      this.drag = null;
    };
    const leave = () => {
      this.hover = null;
      this.dirty = true;
    };
    const wheel = (e: WheelEvent) => {
      if (this.mode === "live") return;
      e.preventDefault();
      const next = e.deltaY > 0 ? this.count * ZOOM_STEP : this.count / ZOOM_STEP;
      this.count = Math.round(Math.min(MAX_BARS, Math.max(MIN_BARS, next)));
      this.yLo = Number.NaN;
      this.dirty = true;
    };
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerdown", down);
    this.canvas.addEventListener("pointerup", up);
    this.canvas.addEventListener("pointerleave", leave);
    this.canvas.addEventListener("wheel", wheel, { passive: false });
    const vis = () => {
      this.dirty = true;
    };
    document.addEventListener("visibilitychange", vis);
    this.cleanups.push(
      () => ro.disconnect(),
      () => io.disconnect(),
      () => theme.disconnect(),
      () => document.removeEventListener("visibilitychange", vis),
    );
  }

  private resize() {
    const r = this.box.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || document.hidden) return;
    this.frame++;
    // Clear the flag first: drawing may set it again (an easing range that has not settled yet).
    const wasDirty = this.dirty;
    this.dirty = false;
    if (this.mode === "live") {
      this.stepLive();
      this.draw();
    } else if (wasDirty) {
      this.draw();
    }
  };

  private plotW() {
    return this.w - AXIS_W;
  }

  private plotH() {
    return this.h - (this.mode === "live" ? 0 : TIME_H);
  }

  // ── live mode ──

  private stepLive() {
    if (Number.isNaN(this.target)) return;
    this.shown += (this.target - this.shown) * EASE_PRICE;
    this.ring[this.ringAt] = this.shown;
    this.ringAt = (this.ringAt + 1) % RING;
    this.ringLen = Math.min(RING, this.ringLen + 1);
    let lo = this.shown;
    let hi = this.shown;
    for (let i = 0; i < this.ringLen; i++) {
      const v = this.ring[i] ?? this.shown;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const minHalf = this.shown * STEP_FRACTION * HALF_STEPS;
    const wantHalf = Math.max(minHalf, ((hi - lo) / 2) * RANGE_MARGIN);
    const wantCenter = (hi + lo) / 2;
    this.half += (wantHalf - this.half) * EASE_RANGE;
    this.center += (wantCenter - this.center) * EASE_RANGE;
  }

  private liveY(price: number) {
    const top = PAD_TOP;
    const bottom = this.h - PAD_TOP;
    return bottom - ((price - (this.center - this.half)) / (2 * this.half || 1)) * (bottom - top);
  }

  // ── drawing ──

  private draw() {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.drawDots();
    this.drawWatermark();
    if (this.mode === "live") this.drawLive();
    else this.drawHistory();
  }

  private drawDots() {
    const drift = (this.mode === "live" ? this.frame * DOT_DRIFT_PX_PER_FRAME : 0) % DOT_SPACING;
    paintDots(this.ctx, this.colors, this.plotW(), this.h, DOT_SPACING, drift);
  }

  private drawWatermark() {
    const size = Math.min(this.plotW(), this.h) * WATERMARK_SIZE;
    paintWatermark(this.ctx, this.colors, this.watermark, this.plotW(), this.h, size);
  }

  private drawAxis(lo: number, hi: number, yOf: (p: number) => number) {
    paintAxis(this.ctx, this.colors, this.plotW(), lo, hi, GRID_LINES, yOf, this.format);
  }

  private pill(y: number, text: string, fill: string, ink: string) {
    paintPill(this.ctx, this.colors, this.plotW(), AXIS_W, y, text, fill, ink);
  }

  private drawLevels(yOf: (p: number) => number) {
    paintLevels(this.ctx, this.colors, this.levels, this.plotW(), this.plotH(), yOf, this.format);
  }

  private drawLive() {
    if (this.ringLen < 2) return;
    this.drawAxis(this.center - this.half, this.center + this.half, (p) => this.liveY(p));
    const step = this.plotW() / (RING - 1);
    const start = RING - this.ringLen;
    const points: Point[] = [];
    for (let k = 0; k < this.ringLen; k++) {
      const idx = (this.ringAt - this.ringLen + k + RING) % RING;
      points.push({ x: (start + k) * step, y: this.liveY(this.ring[idx] ?? this.shown) });
    }
    const phase = (performance.now() % PULSE_MS) / PULSE_MS;
    const head = paintLiveLine(this.ctx, this.colors, points, this.plotW(), this.h, TAIL_FRACTION);
    this.drawLevels((p) => this.liveY(p));
    if (!head) return;
    paintHead(this.ctx, this.colors, head, this.plotW(), phase);
    this.pill(head.y, this.format(this.shown), this.colors.accent, this.colors.accentInk);
  }

  private visibleBars(): Bar[] {
    const end = this.bars.length - Math.floor(this.offset);
    return this.bars.slice(Math.max(0, end - this.count), end);
  }

  /** Eases the price range toward what the visible bars need (redraws until it settles). */
  private easeRange(lo: number, hi: number) {
    const pad = (hi - lo || hi * RANGE_FLOOR || 1) * CANDLE_PAD;
    const wantLo = lo - pad;
    const wantHi = hi + pad;
    this.yLo = Number.isNaN(this.yLo) ? wantLo : this.yLo + (wantLo - this.yLo) * EASE_BARS;
    this.yHi = Number.isNaN(this.yHi) ? wantHi : this.yHi + (wantHi - this.yHi) * EASE_BARS;
    if (Math.abs(this.yLo - wantLo) > SETTLED || Math.abs(this.yHi - wantHi) > SETTLED) this.dirty = true;
  }

  private drawHistory() {
    const bars = this.visibleBars();
    if (bars.length === 0) return;
    const candles = this.mode === "candles";
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const b of bars) {
      lo = Math.min(lo, candles ? b.l : b.c);
      hi = Math.max(hi, candles ? b.h : b.c);
    }
    this.easeRange(lo, hi);
    const top = PAD_TOP;
    const bottom = this.plotH() - (candles ? this.plotH() * VOLUME_SHARE : 0);
    const yOf = (p: number) => bottom - ((p - this.yLo) / (this.yHi - this.yLo || 1)) * (bottom - top);
    this.drawAxis(this.yLo, this.yHi, yOf);
    const spacing = this.plotW() / this.count;
    const xOf = (i: number) => this.plotW() - (bars.length - i - HALF_BAR) * spacing - (this.offset % 1) * spacing;
    const frame: Frame = {
      ctx: this.ctx,
      colors: this.colors,
      bars,
      xOf,
      yOf,
      spacing,
      plotW: this.plotW(),
      plotH: this.plotH(),
    };
    if (candles) paintCandles(frame, BODY_RATIO, VOLUME_SHARE);
    else paintHistoryLine(frame, top, bottom);
    paintTimeLabels(frame, TIME_H, TIME_LABEL_EVERY_PX, this.formatTime);
    this.drawLevels(yOf);
    const last = bars.at(-1);
    if (last && this.offset < 1) {
      const y = yOf(last.c);
      paintGuide(this.ctx, this.colors, y, 0, this.plotW());
      this.pill(y, this.format(last.c), this.colors.accent, this.colors.accentInk);
    }
    if (this.hover && this.hover.x <= this.plotW()) {
      const under = paintCrosshair(frame, this.hover, candles, this.format, this.formatTime);
      if (under) {
        const span = yOf(this.yLo) - yOf(this.yHi) || 1;
        const priceAt = this.yLo + ((yOf(this.yLo) - this.hover.y) / span) * (this.yHi - this.yLo);
        this.pill(this.hover.y, this.format(priceAt), this.colors.surface, this.colors.ink);
      }
    }
  }
}

export type { Bar, ChartMode, ChartOptions, Levels } from "./types";
