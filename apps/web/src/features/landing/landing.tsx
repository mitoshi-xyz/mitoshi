import { ArrowRight, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Mark, VenueMark } from "../marks/mark";
import { Seal } from "../shell/seal";
import { SceneArt } from "../welcome/scene-art";
import { LANDING as L, REPO_URL } from "./copy";
import { HeroVisual } from "./hero-visual";
import { Tape } from "./tape";
import "@/styles/landing.css";
import "@/styles/welcome.css";

function Nav() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] px-3 pt-3">
      <nav className="lp-nav" aria-label="Mitoshi">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Mitoshi home">
          <Seal size={34} />
          <span className="font-extrabold font-heading text-[19px] tracking-[0.02em]">MITOSHI</span>
          <span className="hidden font-stamp text-[14px] text-[var(--lp-ink-3)] sm:inline">見通し</span>
        </Link>
        <div className="mx-auto hidden items-center gap-1 md:flex">
          {[
            ["#how", L.nav.how],
            ["#venues", L.nav.venues],
            ["/privacy", L.nav.privacy],
            ["/docs", L.nav.docs],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-3.5 py-2.5 font-semibold text-[14px] text-[var(--lp-ink-2)] hover:bg-[var(--lp-line)] hover:text-[var(--lp-ink)]"
            >
              {label}
            </a>
          ))}
        </div>
        <Link href="/markets" className="lp-btn lp-btn-accent lp-btn-sm ml-auto md:ml-0">
          {L.nav.open}
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pb-16" aria-labelledby="lp-h1">
      <div className="lp-ground" aria-hidden />
      <div className="lp-glow" aria-hidden />
      <div className="lp-grain" aria-hidden />
      <span className="lp-wordmark" aria-hidden>
        見通し
      </span>
      <Nav />
      <div className="lp-wrap relative grid items-center gap-12 pt-12 md:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="lp-rise flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-card-2)] px-3 py-1.5 text-[13px] shadow-[inset_0_0_0_1px_var(--lp-line)]">
            <span className="size-1.5 rounded-full bg-[var(--up)]" />
            {L.hero.chip}
            <Mark symbol="ZEC" size={16} />
            <VenueMark venue="near" size={16} />
          </span>
          <h1 id="lp-h1" className="lp-h1">
            <span className="block">{L.hero.title[0]}</span>
            <span className="block">
              {L.hero.title[1]} <em>{L.hero.accent}</em>
            </span>
          </h1>
          <p className="lp-line max-w-[34rem]">{L.hero.line}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/markets" className="lp-btn lp-btn-accent">
              {L.hero.open} <ArrowRight size={18} />
            </Link>
            <a href="#how" className="lp-btn lp-btn-glass">
              {L.hero.how}
            </a>
          </div>
          <p className="text-[13px] text-[var(--lp-ink-3)]">{L.hero.small}</p>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="lp-wrap scroll-mt-24 py-20 md:py-28">
      <div className="mb-10 flex max-w-3xl flex-col gap-3">
        <span className="lp-kicker">{kicker}</span>
        <h2 className="lp-h2">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Problem() {
  return (
    <Section kicker={L.problem.kicker} title={L.problem.title}>
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <p className="lp-line max-w-2xl">{L.problem.body}</p>
        <figure className="lp-card p-5">
          <div className="flex items-center gap-3">
            <VenueMark venue="polymarket" size={28} />
            <span className="num font-semibold text-[15px]">{L.problem.feedTitle}</span>
            <span className="ml-auto rounded-full bg-[var(--down-wash)] px-2.5 py-1 font-medium text-[12px] text-[var(--down)]">
              {L.problem.followers}
            </span>
          </div>
          <ul className="mt-4 flex flex-col divide-y divide-[var(--lp-line)]">
            {L.problem.feed.map(([who, what, when]) => (
              <li key={who} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5 text-[13px]">
                <span className="num text-[var(--lp-ink-3)]">bot {who}</span>
                <span className="num text-[var(--lp-ink)]">{what}</span>
                <span className="num text-[var(--down)]">{when}</span>
              </li>
            ))}
          </ul>
          <figcaption className="mt-3 text-[12px] text-[var(--lp-ink-3)]">{L.problem.feedNote}</figcaption>
        </figure>
      </div>
    </Section>
  );
}

function How() {
  return (
    <Section id="how" kicker={L.how.kicker} title={L.how.title}>
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {L.how.steps.map((s, i) => (
          <li key={s.title} className="lp-card flex flex-col gap-3 p-5">
            <div className="rounded-[18px] bg-[var(--stage)] p-2 shadow-[inset_0_0_0_1px_var(--lp-line)]">
              <SceneArt scene={s.scene} />
            </div>
            <span className="font-mono text-[12px] text-[#e04d26]">0{i + 1}</span>
            <h3 className="font-bold font-heading text-[20px] tracking-[-0.01em]">{s.title}</h3>
            <p className="text-[15px] text-[var(--lp-ink-2)] leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Sees() {
  return (
    <Section kicker={L.sees.kicker} title={L.sees.title}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="lp-card p-6">
          <h3 className="mb-4 font-semibold text-[16px] text-[var(--lp-ink-2)]">{L.sees.publicTitle}</h3>
          <dl className="divide-y divide-[var(--lp-line)]">
            {L.sees.publicRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-[15px]">
                <dt className="text-[var(--lp-ink-2)]">{k}</dt>
                <dd className="num text-[var(--down)]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="lp-card p-6 shadow-[inset_0_0_0_1px_color-mix(in_srgb,#e04d26_40%,transparent),0_40px_80px_-40px_#000]">
          <h3 className="mb-4 flex items-center gap-2 font-semibold text-[16px]">
            <Seal size={20} /> {L.sees.mitoshiTitle}
          </h3>
          <dl className="divide-y divide-[var(--lp-line)]">
            {L.sees.mitoshiRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-[15px]">
                <dt className="text-[var(--lp-ink-2)]">{k}</dt>
                <dd className="num text-[var(--up)]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-[var(--lp-ink-3)]">{L.sees.note}</p>
    </Section>
  );
}

function Venues() {
  return (
    <Section id="venues" kicker={L.venues.kicker} title={L.venues.title}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {L.venues.items.map((v) => (
          <Link
            key={v.venue}
            href={v.venue === "polymarket" ? "/predict" : v.venue === "hyperliquid" ? "/trade" : "/tokens"}
            className="lp-card group flex flex-col gap-4 p-6 transition-transform duration-300 hover:-translate-y-1"
          >
            <VenueMark venue={v.venue} size={44} />
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[12px] text-[var(--lp-ink-3)] uppercase tracking-[0.14em]">{v.what}</span>
              <span className="font-bold font-heading text-[22px]">{v.name}</span>
            </div>
            <p className="text-[15px] text-[var(--lp-ink-2)] leading-relaxed">{v.body}</p>
            <span className="mt-auto inline-flex items-center gap-1.5 font-semibold text-[#e04d26] text-[14px]">
              Open <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-5 text-[15px] text-[var(--lp-ink-2)]">{L.venues.funding}</p>
    </Section>
  );
}

function Privacy() {
  return (
    <Section kicker={L.privacy.kicker} title={L.privacy.title}>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {L.privacy.path.map((p, i) => (
          <li key={p.who} className="lp-card relative flex flex-col gap-1.5 p-5">
            <span className="font-mono text-[12px] text-[#e04d26]">{i + 1}</span>
            <span className="font-semibold text-[17px]">{p.who}</span>
            <span className="text-[14px] text-[var(--lp-ink-2)]">sees {p.sees}</span>
          </li>
        ))}
      </ol>
      <ul className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
        {L.privacy.rules.map((r) => (
          <li key={r} className="flex gap-3 text-[15px] text-[var(--lp-ink-2)]">
            <Check size={18} className="mt-0.5 shrink-0 text-[var(--up)]" />
            {r}
          </li>
        ))}
      </ul>
      <Link href="/privacy" className="lp-btn lp-btn-glass mt-8">
        {L.privacy.more} <ArrowRight size={17} />
      </Link>
    </Section>
  );
}

const BUILT: { mark: "zcash" | "near" | "polymarket" | "hyperliquid" | "jupiter"; name: string }[] = [
  { mark: "zcash", name: "Zcash" },
  { mark: "near", name: "NEAR Intents" },
  { mark: "polymarket", name: "Polymarket" },
  { mark: "hyperliquid", name: "Hyperliquid" },
  { mark: "jupiter", name: "Jupiter" },
];

function Built() {
  return (
    <section className="lp-wrap py-10">
      <span className="lp-kicker">{L.built.kicker}</span>
      <ul className="mt-5 flex flex-wrap items-center gap-x-10 gap-y-5">
        {BUILT.map((b) => (
          <li key={b.name} className="flex items-center gap-3 text-[17px] text-[var(--lp-ink-2)]">
            <VenueMark venue={b.mark} size={30} />
            {b.name}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Faq() {
  return (
    <section className="lp-wrap py-20">
      <h2 className="lp-h2 mb-8">{L.faq.title}</h2>
      <div className="flex max-w-3xl flex-col divide-y divide-[var(--lp-line)] border-[var(--lp-line)] border-y">
        {L.faq.items.map((f) => (
          <details key={f.q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[18px]">
              {f.q}
              <ChevronDown size={18} className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-[15px] text-[var(--lp-ink-2)] leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Final() {
  return (
    <section className="lp-wrap py-20">
      <div className="lp-card relative overflow-hidden p-10 text-center md:p-16">
        <div className="lp-glow" aria-hidden />
        <h2 className="lp-h2 relative mx-auto max-w-2xl">{L.final.title}</h2>
        <Link href="/markets" className="lp-btn lp-btn-accent relative mt-8">
          {L.final.open} <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-wrap flex flex-wrap items-center gap-x-6 gap-y-3 border-[var(--lp-line)] border-t py-8 text-[14px] text-[var(--lp-ink-3)]">
      <span className="flex items-center gap-2 text-[var(--lp-ink-2)]">
        <Seal size={22} /> Mitoshi 見通し
      </span>
      <span>{L.footer.built}</span>
      <span className="ml-auto flex flex-wrap gap-5">
        <a href={REPO_URL} className="hover:text-[var(--lp-ink)]">
          {L.footer.repo}
        </a>
        <a href="/docs" className="hover:text-[var(--lp-ink)]">
          {L.footer.docs}
        </a>
        <a href="/privacy" className="hover:text-[var(--lp-ink)]">
          {L.footer.privacy}
        </a>
        <a href="/settings#status" className="hover:text-[var(--lp-ink)]">
          {L.footer.status}
        </a>
      </span>
    </footer>
  );
}

/** The landing: one dark world, the live product in the hero, then how it works, what's public, venues, privacy. */
export function Landing() {
  return (
    <main className="lp">
      <Hero />
      <Tape />
      <Problem />
      <How />
      <Sees />
      <Venues />
      <Privacy />
      <Built />
      <Faq />
      <Final />
      <Footer />
    </main>
  );
}
