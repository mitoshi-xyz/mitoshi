import type { Cue } from "../feedback";

/** Sound and touch cue tables (frequencies, timings, vibration patterns). */
export const PREF_KEY = "mitoshi:feedback";
export const MASTER_GAIN = 0.06;
export const ATTACK_S = 0.006;
export const SILENCE = 0.0001;
/** Length of the shared noise buffer clicks are cut from, in seconds. */
export const NOISE_S = 0.05;

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
  /**
   * A burst of band-passed noise instead of a tone, centred on `f` (Q is the band's sharpness): the transient a
   * physical click makes. It decays from the first sample, so it reads as a tick rather than a beep.
   */
  noise?: { q: number };
}

export const CUES: Record<Cue, Note[]> = {
  // A click: a 12 ms noise tick in the upper mids, with a 4 ms low knock under it for body.
  tap: [
    { f: 3200, at: 0, len: 0.012, gain: 0.9, noise: { q: 1.2 } },
    { f: 190, at: 0, len: 0.018, gain: 0.35, to: 120 },
  ],
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
