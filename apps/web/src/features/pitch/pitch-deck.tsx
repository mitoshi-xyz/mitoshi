"use client";

import { ArrowLeft, ArrowRight, NotebookPen, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Seal } from "../shell/seal";
import { PITCH, type PitchSlide } from "./copy";
import "@/styles/landing.css";
import "@/styles/pitch.css";

const NEXT_KEYS = ["ArrowRight", "ArrowDown", "PageDown", " "];
const BACK_KEYS = ["ArrowLeft", "ArrowUp", "PageUp"];
const FOLIO_DIGITS = 2;
const COVER = { w: 1280, h: 720 };
const PHONE = { w: 750, h: 1624 };
const PHONES = [
  { src: "/captures/event.jpg", alt: "A Polymarket event in Mitoshi with its odds chart and Yes / No" },
  { src: "/captures/terminal.jpg", alt: "The NVIDIA terminal on Polymarket Perps with Long and Short" },
  { src: "/captures/order.jpg", alt: "The Long NVIDIA order sheet: $25 at 5×" },
] as const;

const folio = (n: number) => String(n).padStart(FOLIO_DIGITS, "0");

function Visual({ slide }: { slide: PitchSlide }) {
  switch (slide.id) {
    case "watch":
      return (
        <Link href="/demo" className="pd-cover lp-card group" aria-label={slide.cta.label}>
          <img src="/demo/still.webp" width={COVER.w} height={COVER.h} alt="" />
          <span className="pd-play">
            <Play size={22} fill="currentColor" />
          </span>
        </Link>
      );
    case "problem":
      return (
        <div className="pd-quotes">
          {slide.quotes.map((q) => (
            <figure key={q.text} className="lp-card pd-quote">
              <blockquote>“{q.text}”</blockquote>
              <figcaption>
                {q.who} · {q.when}
              </figcaption>
            </figure>
          ))}
        </div>
      );
    case "today":
      return (
        <div className="pd-phones">
          {PHONES.map((p) => (
            <img key={p.src} src={p.src} width={PHONE.w} height={PHONE.h} alt={p.alt} />
          ))}
        </div>
      );
    case "users":
      return (
        <div className="pd-groups">
          {slide.groups.map((g) => (
            <div key={g.n} className="lp-card pd-group">
              <span className="lp-kicker">{g.n}</span>
              <strong>{g.title}</strong>
              <p>{g.line}</p>
            </div>
          ))}
        </div>
      );
    case "next":
      return (
        <div className="pd-stamp" aria-hidden>
          <Seal size={160} />
          <span>見通し</span>
        </div>
      );
  }
}

function Copy({ slide }: { slide: PitchSlide }) {
  return (
    <div className="pd-copy">
      <span className="lp-kicker">{slide.kicker}</span>
      <h1 className="pd-title">{slide.title}</h1>
      {"line" in slide ? <p className="lp-line">{slide.line}</p> : null}
      {"points" in slide ? (
        <ul className="pd-points">
          {slide.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {"small" in slide ? <p className="pd-small">{slide.small}</p> : null}
      {"cta" in slide ? (
        <Link href={slide.cta.href} className="lp-btn lp-btn-accent self-start">
          {slide.cta.label} <ArrowRight size={18} />
        </Link>
      ) : null}
      {"closing" in slide ? <strong className="pd-closing">{slide.closing}</strong> : null}
    </div>
  );
}

/** Five slides to record a pitch over: arrows, space or the dots move; N shows what to say. */
export function PitchDeck() {
  const slides = PITCH.slides;
  const [index, setIndex] = useState(0);
  const [notes, setNotes] = useState(false);
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(slides.length - 1, i))), [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]")) return;
      if (NEXT_KEYS.includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.min(slides.length - 1, i + 1));
      } else if (BACK_KEYS.includes(e.key)) {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
      else if (e.key.toLowerCase() === "n") setNotes((n) => !n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slides.length]);

  const slide = slides[index] ?? slides[0];
  return (
    <main className="lp pd" aria-label={PITCH.name}>
      <div className="lp-ground" aria-hidden />
      <div className="lp-glow" aria-hidden />
      <header className="pd-head">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Mitoshi home">
          <Seal size={30} />
          <span className="font-extrabold font-heading text-[17px] tracking-[0.02em]">MITOSHI</span>
        </Link>
        <span className="pd-folio">
          [ {folio(index + 1)} / {folio(slides.length)} ] · {slide.label}
        </span>
      </header>

      <article key={slide.id} className="pd-slide" aria-live="polite" aria-label={`Slide ${index + 1}: ${slide.label}`}>
        <Copy slide={slide} />
        <div className="pd-visual">
          <Visual slide={slide} />
        </div>
      </article>

      {notes ? (
        <aside id="pd-notes" className="pd-notes" aria-label="What to say">
          <span className="lp-kicker">What to say</span>
          <p>{slide.notes}</p>
        </aside>
      ) : null}

      <footer className="pd-foot">
        <button
          type="button"
          className="pd-btn"
          onClick={() => setNotes((n) => !n)}
          aria-expanded={notes}
          aria-controls="pd-notes"
          title="What to say (N)"
        >
          <NotebookPen size={16} /> <span>Notes</span>
        </button>
        <nav className="pd-dots" aria-label="Slides">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(i)}
              className="pd-dot"
              aria-label={`Slide ${i + 1}: ${s.label}`}
              aria-current={i === index ? "step" : undefined}
            />
          ))}
        </nav>
        <div className="flex gap-2">
          <button
            type="button"
            className="pd-btn"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            className="pd-btn"
            onClick={() => go(index + 1)}
            disabled={index === slides.length - 1}
            aria-label="Next"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </footer>
    </main>
  );
}
