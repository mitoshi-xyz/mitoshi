"use client";

import { useRouter } from "next/navigation";
import { type PointerEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/kit";
import { WELCOME } from "./copy";
import { SceneArt } from "./scene-art";
import "@/styles/welcome.css";

const SCENE_MS = 5_000;
const SWIPE_PX = 40;

/**
 * The first-run story: five scenes that advance on their own (until the reader swipes, taps a dot or
 * uses the arrow keys; never under reduced motion), over the three ways in. `footer` carries the
 * engine's loading line, since the wallet engine downloads while the story plays.
 */
export function Story({
  onCreate,
  onRestore,
  footer,
}: {
  onCreate: () => void;
  onRestore: () => void;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const startX = useRef<number | null>(null);
  const count = WELCOME.scenes.length;
  const scene = WELCOME.scenes[at] ?? WELCOME.scenes[0];

  const go = useCallback((next: number) => setAt(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => go(at + 1), SCENE_MS);
    return () => window.clearTimeout(t);
  }, [at, held, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      setHeld(true);
      go(e.key === "ArrowRight" ? at + 1 : at - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go]);

  const onDown = (e: PointerEvent) => {
    startX.current = e.clientX;
  };
  const onUp = (e: PointerEvent) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) < SWIPE_PX) return;
    setHeld(true);
    go(dx < 0 ? at + 1 : at - 1);
  };

  return (
    <div className="wl">
      <section
        className="wl-stage"
        onPointerDown={onDown}
        onPointerUp={onUp}
        aria-roledescription="carousel"
        aria-label={WELCOME.scene(at + 1, count)}
      >
        <div key={scene.key} className="w-full">
          <SceneArt scene={scene.key} />
        </div>
      </section>
      <div className="wl-words" aria-live="polite">
        <h1 key={`t-${scene.key}`} className="wl-title">
          {scene.title}
        </h1>
        <p key={`b-${scene.key}`} className="wl-body">
          {scene.body}
        </p>
      </div>
      <div className="wl-dots">
        {WELCOME.scenes.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className="wl-dot-btn"
            aria-label={WELCOME.scene(i + 1, count)}
            aria-current={i === at ? "step" : undefined}
            onClick={() => {
              setHeld(true);
              go(i);
            }}
          />
        ))}
      </div>
      <div className="flex w-full flex-col gap-2.5">
        <Button tone="primary" size="lg" onClick={onCreate}>
          {WELCOME.create}
        </Button>
        <Button size="lg" onClick={onRestore}>
          {WELCOME.restore}
        </Button>
        <button
          type="button"
          onClick={() => router.push("/markets")}
          className="h-11 font-medium text-[15px] text-ink-2 hover:text-ink"
        >
          {WELCOME.look}
        </button>
        {footer}
      </div>
    </div>
  );
}
