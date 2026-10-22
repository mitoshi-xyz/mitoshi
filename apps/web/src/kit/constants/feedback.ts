import type { Cue } from "../feedback";

/** Sound and touch cue tables (frequencies, timings, vibration patterns). */
export const PREF_KEY = "mitoshi:feedback";
export const MASTER_GAIN = 0.06;
export const ATTACK_S = 0.006;
export const SILENCE = 0.0001;

export interface Note {
  /** Hz. */
  f: number;
  /** Start, seconds after the cue. */
  at: number;
  /** Length, seconds. */
  len: number;
  type?: OscillatorType;
  gain?: number;
  /** Glide to this frequency over the note. */
  to?: number;
}

export const CUES: Record<Cue, Note[]> = {
  tap: [{ f: 1320, at: 0, len: 0.035, gain: 0.5 }],
  open: [
    { f: 660, at: 0, len: 0.06, type: "triangle" },
    { f: 990, at: 0.05, len: 0.08, type: "triangle" },
  ],
  close: [
    { f: 990, at: 0, len: 0.05, type: "triangle", gain: 0.7 },
    { f: 660, at: 0.04, len: 0.07, type: "triangle", gain: 0.7 },
  ],
  send: [{ f: 420, at: 0, len: 0.22, type: "sine", to: 880 }],
  arrive: [
    { f: 1318.5, at: 0, len: 0.45, type: "sine" },
    { f: 1975.5, at: 0, len: 0.3, type: "sine", gain: 0.35 },
  ],
  fill: [
    { f: 784, at: 0, len: 0.07, type: "triangle" },
    { f: 1175, at: 0.06, len: 0.12, type: "triangle" },
  ],
  win: [
    { f: 1046.5, at: 0, len: 0.09, type: "triangle" },
    { f: 1318.5, at: 0.08, len: 0.09, type: "triangle" },
    { f: 1568, at: 0.16, len: 0.18, type: "triangle" },
  ],
  loss: [
    { f: 784, at: 0, len: 0.1, type: "sine" },
    { f: 659.3, at: 0.09, len: 0.1, type: "sine" },
    { f: 523.3, at: 0.18, len: 0.2, type: "sine" },
  ],
  error: [
    { f: 220, at: 0, len: 0.07, type: "square", gain: 0.25 },
    { f: 196, at: 0.1, len: 0.09, type: "square", gain: 0.25 },
  ],
};

export const BUZZ: Record<Cue, number | number[]> = {
  tap: 8,
  open: 10,
  close: 6,
  send: [12, 40, 12],
  arrive: [20, 60, 30],
  fill: [15, 30, 15],
  win: [15, 40, 15, 40, 25],
  loss: 45,
  error: [40, 50, 40],
};
