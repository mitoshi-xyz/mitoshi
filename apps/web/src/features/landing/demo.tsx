import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { DEMO_VIDEO_URL, LANDING as L } from "./copy";
import { LandingFooter, LandingNav } from "./frame";
import "@/styles/landing.css";

const STILL = { w: 1280, h: 720 };

/**
 * /demo: the product recording. Until it exists the page shows a still from the real app, labelled as pending; once
 * DEMO_VIDEO_URL is set, the cover links out to YouTube (an embed would load YouTube's scripts on this origin).
 */
export function Demo() {
  return (
    <main className="lp">
      <section className="relative overflow-hidden pb-16" aria-labelledby="lp-demo">
        <div className="lp-ground" aria-hidden />
        <div className="lp-glow" aria-hidden />
        <LandingNav />
        <div className="lp-wrap relative flex flex-col items-center gap-8 pt-10 md:pt-16">
          <div className="flex flex-col items-center gap-3">
            <h1 id="lp-demo" className="lp-h2 text-center">
              {L.demo.title}
            </h1>
            {DEMO_VIDEO_URL ? null : (
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-card-2)] px-3 py-1.5 font-semibold text-[13px] shadow-[inset_0_0_0_1px_var(--lp-line)]">
                <span className="size-1.5 rounded-full bg-[var(--accent)]" /> {L.demo.pending}
              </span>
            )}
          </div>
          {DEMO_VIDEO_URL ? (
            <a
              href={DEMO_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-card group relative block w-full max-w-[960px] overflow-hidden"
            >
              <img
                src="/demo/cover.webp"
                width={STILL.w}
                height={STILL.h}
                alt={L.demo.coverAlt}
                className="block h-auto w-full"
              />
              <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-[#050505]/75 px-3 py-1.5 font-semibold text-[14px] backdrop-blur group-hover:bg-[#050505]/90">
                <Play size={14} /> {L.demo.watch}
              </span>
            </a>
          ) : (
            <figure className="lp-card w-full max-w-[960px] overflow-hidden">
              <img
                src="/demo/still.webp"
                width={STILL.w}
                height={STILL.h}
                alt={L.demo.stillAlt}
                className="block h-auto w-full"
              />
            </figure>
          )}
          {DEMO_VIDEO_URL ? null : <p className="lp-line text-center">{L.demo.line}</p>}
          <div className="flex flex-wrap justify-center gap-3">
            {L.demo.tries.map((t) => (
              <Link key={t.href} href={t.href} className="lp-btn lp-btn-glass">
                {t.label} <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <LandingFooter />
    </main>
  );
}
