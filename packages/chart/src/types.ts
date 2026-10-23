/** The chart engine's public shapes. */

export interface Bar {
  /** Open time, ms since the epoch. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export type ChartMode = "live" | "line" | "candles";

export interface Levels {
  entry?: number | null;
  takeProfit?: number | null;
  stopLoss?: number | null;
  liquidation?: number | null;
}

export type TimeFormat = (ms: number, spanMs: number, precise: boolean) => string;

export interface ChartOptions {
  mode?: ChartMode;
  /** The faint glyphs behind the line. */
  watermark?: string;
  /** How a price is written on the axis and pill. */
  format?: (price: number) => string;
  /** How a time is written on the axis and, `precise`, under the pointer; `spanMs` is the time on screen. */
  formatTime?: TimeFormat;
  /** Where the colour tokens are read from (default: the document): a page section with its own palette. */
  colorsFrom?: Element;
}
