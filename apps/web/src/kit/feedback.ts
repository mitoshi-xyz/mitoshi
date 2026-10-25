"use client";

import { ATTACK_S, BUZZ, CUES, MASTER_GAIN, NOISE_S, PREF_KEY, SILENCE } from "./constants/feedback";
/**
 * Sound and touch for the moments that matter: a tap, a drawer, money sent, money arrived, a fill,
 * a win, a loss, an error. The sounds are synthesised (WebAudio, nothing downloaded) and quiet;
 * haptics use the Vibration API where the device has it. Both can be switched off in Settings.
 */
export type Cue = "tap" | "open" | "close" | "send" | "arrive" | "fill" | "win" | "loss" | "error";

export interface FeedbackPrefs {
  sound: boolean;
  haptics: boolean;
}

export function feedbackPrefs(): FeedbackPrefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (raw) return { sound: true, haptics: true, ...(JSON.parse(raw) as Partial<FeedbackPrefs>) };
  } catch {
    // Storage blocked: fall back to the defaults.
  }
  return { sound: true, haptics: true };
}

export function setFeedbackPrefs(p: FeedbackPrefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: the choice lasts this page only.
  }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Plays a cue (sound and haptic, as the person has them set). Silent until the page has had a gesture. */
export function cue(name: Cue) {
  const prefs = feedbackPrefs();
  if (prefs.haptics && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(BUZZ[name]);
  if (!prefs.sound) return;
  const a = audio();
  if (a?.state !== "running") return;
  const t0 = a.currentTime;
  const master = a.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(a.destination);
  for (const n of CUES[name]) {
    if (n.noise) {
      tick(a, master, t0, n.f, n.noise.q, n.at, n.len, n.gain ?? 1);
      continue;
    }
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.setValueAtTime(n.f, t0 + n.at);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t0 + n.at + n.len);
    g.gain.setValueAtTime(0, t0 + n.at);
    g.gain.linearRampToValueAtTime(n.gain ?? 1, t0 + n.at + ATTACK_S);
    g.gain.exponentialRampToValueAtTime(SILENCE, t0 + n.at + n.len);
    osc.connect(g).connect(master);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.len + ATTACK_S);
  }
}

let noise: AudioBuffer | null = null;

/** A noise transient through a band-pass filter: full level at once, gone within `len`. */
function tick(
  a: AudioContext,
  out: AudioNode,
  t0: number,
  f: number,
  q: number,
  at: number,
  len: number,
  gain: number,
) {
  if (!noise || noise.sampleRate !== a.sampleRate) {
    noise = a.createBuffer(1, Math.ceil(a.sampleRate * NOISE_S), a.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noise;
  const band = a.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = f;
  band.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0 + at);
  g.gain.exponentialRampToValueAtTime(SILENCE, t0 + at + len);
  src.connect(band).connect(g).connect(out);
  src.start(t0 + at);
  src.stop(t0 + at + len + ATTACK_S);
}

/** Wakes the audio on the first gesture, so later cues (a wallet getting ready) can play. */
export function primeFeedback() {
  if (typeof window === "undefined") return;
  const wake = () => {
    audio();
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
  };
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);
}
