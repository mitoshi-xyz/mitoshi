import type { ReactNode } from "react";

/**
 * A small kit for the hand-drawn system maps. Every colour is a class from diagrams.css (tokens of the current theme),
 * every size is in viewBox units. Each figure has a wide drawing and a tall one for phones; diagrams.css shows the one
 * that fits the column, so text never shrinks below ~11 px.
 */

export type Tone = "plain" | "accent" | "quiet";

/** Text metrics used to size boxes, in viewBox units. */
export const LINE = 19;
const TITLE_BASE = 26;
const KICKER_BASE = 19;
const KICKER_TITLE_GAP = 20;
const FIRST_LINE_GAP = 21;
const BOTTOM_PAD = 14;
export const PAD_X = 14;

/** The height a Box needs for its lines. */
export function boxHeight(lines: number, kicker = false): number {
  const title = kicker ? KICKER_BASE + KICKER_TITLE_GAP : TITLE_BASE;
  return lines === 0 ? title + BOTTOM_PAD : title + FIRST_LINE_GAP + (lines - 1) * LINE + BOTTOM_PAD;
}

export function Box({
  x,
  y,
  w,
  h,
  title,
  kicker,
  lines = [],
  mono = [],
  tone = "plain",
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  title: string;
  kicker?: string;
  /** Body lines, in order. */
  lines?: string[];
  /** Indexes of `lines` set in the mono face (paths, figures). */
  mono?: number[];
  tone?: Tone;
}) {
  const height = h ?? boxHeight(lines.length, Boolean(kicker));
  const titleY = y + (kicker ? KICKER_BASE + KICKER_TITLE_GAP : TITLE_BASE);
  return (
    <g>
      <rect x={x} y={y} width={w} height={height} rx={10} className={`dg-box dg-box-${tone}`} />
      {kicker ? (
        <text x={x + PAD_X} y={y + KICKER_BASE} className="dg-kicker">
          {kicker}
        </text>
      ) : null}
      <text x={x + PAD_X} y={titleY} className="dg-title">
        {title}
      </text>
      {lines.map((line, i) => (
        <text
          key={line}
          x={x + PAD_X}
          y={titleY + FIRST_LINE_GAP + i * LINE}
          className={mono.includes(i) ? "dg-mono" : "dg-body"}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

/** A dashed area that groups boxes, with its name in small capitals. */
export function Zone({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} className="dg-zone" />
      <text x={x + PAD_X} y={y + KICKER_BASE} className="dg-kicker">
        {label}
      </text>
    </g>
  );
}

/** A connection. `d` is an SVG path; the arrowhead sits at its end. */
export function Wire({ d, p, tone = "plain", both = false }: { d: string; p: string; tone?: Tone; both?: boolean }) {
  const head = `url(#${p}-${tone})`;
  return <path d={d} className={`dg-wire dg-wire-${tone}`} markerEnd={head} markerStart={both ? head : undefined} />;
}

/** Lines of small text, e.g. beside a wire. */
export function Note({
  x,
  y,
  lines,
  anchor = "start",
  tone = "plain",
  mono = false,
}: {
  x: number;
  y: number;
  lines: string[];
  anchor?: "start" | "middle" | "end";
  tone?: Tone;
  mono?: boolean;
}) {
  const cls = `${mono ? "dg-mono" : "dg-body"} dg-note-${tone}`;
  return (
    <text x={x} y={y} textAnchor={anchor} className={cls}>
      {lines.map((line, i) => (
        <tspan key={line} x={x} dy={i === 0 ? 0 : LINE}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

/** A small label in a pill that masks the wire under it. Width is estimated from the text. */
const PILL_CHAR = 7;
const PILL_PAD = 10;
const PILL_H = 20;
export function Pill({ x, y, text, tone = "plain" }: { x: number; y: number; text: string; tone?: Tone }) {
  const w = text.length * PILL_CHAR + PILL_PAD * 2;
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - PILL_H / 2}
        width={w}
        height={PILL_H}
        rx={PILL_H / 2}
        className={`dg-pill dg-pill-${tone}`}
      />
      <text x={x} y={y + 4} textAnchor="middle" className={`dg-pill-text dg-note-${tone}`}>
        {text}
      </text>
    </g>
  );
}

/** A key to the wire tones: a short sample line and its meaning, one row each. */
const KEY_SAMPLE = 34;
const KEY_GAP = 10;
export function Key({ x, y, p, items }: { x: number; y: number; p: string; items: { tone: Tone; text: string }[] }) {
  return (
    <g>
      {items.map((item, i) => {
        const rowY = y + i * (LINE + 4);
        return (
          <g key={item.text}>
            <Wire d={`M${x} ${rowY} H${x + KEY_SAMPLE}`} p={p} tone={item.tone} />
            <Note x={x + KEY_SAMPLE + KEY_GAP} y={rowY + 4} lines={[item.text]} />
          </g>
        );
      })}
    </g>
  );
}

/** Arrowheads for the three wire tones, ids prefixed so two drawings on one page never share one. */
function Heads({ p }: { p: string }) {
  return (
    <defs>
      {(["plain", "accent", "quiet"] as const).map((tone) => (
        <marker
          key={tone}
          id={`${p}-${tone}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={9}
          markerHeight={9}
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" className={`dg-head dg-head-${tone}`} />
        </marker>
      ))}
    </defs>
  );
}

/** Tall drawings are laid out on x 14..344; their viewBox crops the margins so phones get bigger text. */
export const TALL_X = 12;
export const TALL_W = 336;

export interface Drawing {
  w: number;
  h: number;
  body: (p: string) => ReactNode;
  /** Where the viewBox starts, to crop an empty margin. */
  x?: number;
}

/** A figure with a wide drawing, a tall one for narrow columns, and a caption. */
export function Figure({
  id,
  label,
  caption,
  wide,
  tall,
}: {
  id: string;
  label: string;
  caption: ReactNode;
  wide: Drawing;
  tall: Drawing;
}) {
  return (
    <figure className="dg not-prose" data-diagram={id}>
      {(
        [
          ["wide", wide],
          ["tall", tall],
        ] as const
      ).map(([kind, d]) => (
        <svg
          key={kind}
          viewBox={`${d.x ?? 0} 0 ${d.w} ${d.h}`}
          className={`dg-svg dg-${kind}`}
          role="img"
          aria-label={label}
          data-variant={kind}
        >
          <Heads p={`${id}-${kind}`} />
          {d.body(`${id}-${kind}`)}
        </svg>
      ))}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
