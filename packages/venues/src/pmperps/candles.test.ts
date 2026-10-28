import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { markCandles, type PerpsCandle } from "./market.ts";

const MIN = 60_000;

describe("Perps candles from the mark", () => {
  it("draws every interval, each opening where the last closed, with the trades' volume", () => {
    const marks: [number, number][] = [
      [0, 100],
      [2 * MIN + 5_000, 103],
    ];
    const trades: PerpsCandle[] = [{ t: 2 * MIN, o: 102, h: 104, l: 101, c: 103, v: 7 }];
    const out = markCandles(marks, trades, MIN, 3 * MIN);
    assert.deepEqual(
      out.map((c) => [c.t, c.o, c.c, c.v]),
      [
        [0, 100, 100, 0],
        [MIN, 100, 100, 0],
        [2 * MIN, 100, 103, 7],
        [3 * MIN, 103, 103, 0],
      ],
    );
    assert.equal(out[2]?.h, 103);
    assert.equal(out[2]?.l, 100);
  });
  it("keeps the trade candles when there is no mark history", () => {
    const trades: PerpsCandle[] = [{ t: 0, o: 1, h: 2, l: 1, c: 2, v: 3 }];
    assert.deepEqual(markCandles([], trades, MIN, MIN), trades);
  });
});
