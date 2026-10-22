import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  LineSeries,
  LineStyle,
  type UTCTimestamp,
} from "lightweight-charts";

/** One candle; `t` is its open time in milliseconds. */
export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export type ChartMode = "candles" | "line";

export interface Levels {
  entry?: number | null;
  takeProfit?: number | null;
  stopLoss?: number | null;
  liquidation?: number | null;
}

export interface ChartColors {
  text: string;
  grid: string;
  up: string;
  down: string;
  line: string;
  entry: string;
  takeProfit: string;
  stopLoss: string;
  liquidation: string;
}

const MS_PER_SECOND = 1000;
const LINE_WIDTH = 2;
const PRICE_LINE_WIDTH = 1;
const RIGHT_OFFSET_BARS = 6;

const DEFAULT_COLORS: ChartColors = {
  text: "rgba(255,255,255,0.6)",
  grid: "rgba(255,255,255,0.05)",
  up: "#34d399",
  down: "#f87171",
  line: "#e5e7eb",
  entry: "#a1a1aa",
  takeProfit: "#34d399",
  stopLoss: "#f87171",
  liquidation: "#f59e0b",
};

const LEVEL_TITLES: Record<keyof Levels, string> = {
  entry: "Entry",
  takeProfit: "TP",
  stopLoss: "SL",
  liquidation: "Liq.",
};

const toTime = (ms: number) => Math.floor(ms / MS_PER_SECOND) as UTCTimestamp;

/**
 * A live market chart. Load history with {@link setBars}, then {@link push} every live candle
 * update (the last bar is replaced while it is still open). Switching between candles and a line
 * keeps the data; price lines mark a position's entry, take profit, stop loss and liquidation.
 */
export class MarketChart {
  private readonly chart: IChartApi;
  private series: ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;
  private mode: ChartMode;
  private bars: Bar[] = [];
  private lines = new Map<keyof Levels, IPriceLine>();
  private levels: Levels = {};
  private readonly colors: ChartColors;

  constructor(container: HTMLElement, mode: ChartMode = "candles", colors: Partial<ChartColors> = {}) {
    this.colors = { ...DEFAULT_COLORS, ...colors };
    this.mode = mode;
    this.chart = createChart(container, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: this.colors.text },
      grid: { vertLines: { color: this.colors.grid }, horzLines: { color: this.colors.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, rightOffset: RIGHT_OFFSET_BARS },
      rightPriceScale: { borderVisible: false },
    });
    this.series = this.makeSeries();
  }

  private makeSeries() {
    if (this.mode === "candles") {
      return this.chart.addSeries(CandlestickSeries, {
        upColor: this.colors.up,
        downColor: this.colors.down,
        wickUpColor: this.colors.up,
        wickDownColor: this.colors.down,
        borderVisible: false,
      });
    }
    return this.chart.addSeries(LineSeries, { color: this.colors.line, lineWidth: LINE_WIDTH });
  }

  private point(b: Bar) {
    return this.mode === "candles"
      ? { time: toTime(b.t), open: b.o, high: b.h, low: b.l, close: b.c }
      : { time: toTime(b.t), value: b.c };
  }

  /** Replaces all bars (a new market or interval). */
  setBars(bars: Bar[]) {
    this.bars = [...bars].sort((a, b) => a.t - b.t);
    (this.series as ISeriesApi<"Candlestick">).setData(this.bars.map((b) => this.point(b)) as never);
    this.chart.timeScale().scrollToRealTime();
  }

  /** A live update: extends the last bar while it is open, or starts a new one. */
  push(bar: Bar) {
    const last = this.bars.at(-1);
    if (last && bar.t < last.t) return;
    if (last && bar.t === last.t) this.bars[this.bars.length - 1] = bar;
    else this.bars.push(bar);
    (this.series as ISeriesApi<"Candlestick">).update(this.point(bar) as never);
  }

  setMode(mode: ChartMode) {
    if (mode === this.mode) return;
    this.chart.removeSeries(this.series);
    this.lines.clear();
    this.mode = mode;
    this.series = this.makeSeries();
    this.setBars(this.bars);
    this.setLevels(this.levels);
  }

  /** Draws (or clears) the position's price lines. */
  setLevels(levels: Levels) {
    this.levels = levels;
    for (const key of Object.keys(LEVEL_TITLES) as (keyof Levels)[]) {
      const price = levels[key];
      const existing = this.lines.get(key);
      if (price === undefined || price === null || !Number.isFinite(price)) {
        if (existing) this.series.removePriceLine(existing);
        this.lines.delete(key);
        continue;
      }
      if (existing) {
        existing.applyOptions({ price });
        continue;
      }
      this.lines.set(
        key,
        this.series.createPriceLine({
          price,
          color: this.colors[key],
          lineWidth: PRICE_LINE_WIDTH,
          lineStyle: key === "entry" ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: LEVEL_TITLES[key],
        }),
      );
    }
  }

  dispose() {
    this.chart.remove();
  }
}
