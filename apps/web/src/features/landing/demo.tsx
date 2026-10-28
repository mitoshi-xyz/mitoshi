import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { DEMO_VIDEO_URL, LANDING as L } from "./copy";
import { DemoPlayer } from "./demo-player";
import { LandingFooter, LandingNav } from "./frame";
import "@/styles/landing.css";

/** /demo: the product recording, played in place behind its cover, with YouTube one click away. */
export function Demo() {
  return (
    <main className="lp">
      <section className="relative overflow-hidden pb-16" aria-labelledby="lp-demo">
        <div className="lp-ground" aria-hidden />
        <div className="lp-glow" aria-hidden />
        <LandingNav />
        <div className="lp-wrap relative flex flex-col items-center gap-8 pt-10 md:pt-16">
          <h1 id="lp-demo" className="lp-h2 text-center">
            {L.demo.title}
          </h1>
          <div className="flex w-full flex-col items-center gap-3">
            <DemoPlayer />
            <a
              href={DEMO_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[14px] text-[var(--ink-2)] hover:text-[var(--ink)]"
            >
              {L.demo.youtube} <ArrowUpRight size={16} />
            </a>
          </div>
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
