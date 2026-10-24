import Link from "next/link";
import { DOCS_URL } from "@/constants";
import { Seal } from "../shell/seal";
import { LANDING as L, REPO_URL } from "./copy";

const LINKS = [
  ["/#how", L.nav.how],
  ["/#venues", L.nav.venues],
  ["/demo", L.nav.demo],
  ["/privacy", L.nav.privacy],
  [DOCS_URL, L.nav.docs],
] as const;

/** The landing's glass nav, shared by the landing and /demo. Demo stays visible on phones, beside Open. */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] px-3 pt-3">
      <nav className="lp-nav" aria-label="Mitoshi">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Mitoshi home">
          <Seal size={34} />
          <span className="font-extrabold font-heading text-[19px] tracking-[0.02em] max-[359px]:hidden">MITOSHI</span>
          <span className="hidden font-stamp text-[14px] text-[var(--lp-ink-3)] sm:inline">見通し</span>
        </Link>
        <div className="mx-auto hidden items-center gap-1 md:flex">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full px-3.5 py-2.5 font-semibold text-[14px] text-[var(--lp-ink-2)] hover:bg-[var(--lp-line)] hover:text-[var(--lp-ink)]"
            >
              {label}
            </Link>
          ))}
        </div>
        <Link
          href="/demo"
          className="ml-auto rounded-full px-2 py-2.5 font-semibold text-[14px] text-[var(--lp-ink-2)] hover:bg-[var(--lp-line)] hover:text-[var(--lp-ink)] md:hidden"
        >
          {L.nav.demo}
        </Link>
        <Link href="/markets" className="lp-btn lp-btn-accent lp-btn-sm md:ml-0">
          <span className="md:hidden">{L.nav.openShort}</span>
          <span className="hidden md:inline">{L.nav.open}</span>
        </Link>
      </nav>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-wrap flex flex-wrap items-center gap-x-6 gap-y-3 border-[var(--lp-line)] border-t py-8 text-[14px] text-[var(--lp-ink-3)]">
      <span className="flex items-center gap-2 text-[var(--lp-ink-2)]">
        <Seal size={22} /> Mitoshi 見通し
      </span>
      <span>{L.footer.built}</span>
      <span className="ml-auto flex flex-wrap gap-5">
        {[
          [REPO_URL, L.footer.repo],
          ["/demo", L.footer.demo],
          ["/pitch", L.footer.pitch],
          [DOCS_URL, L.footer.docs],
          ["/privacy", L.footer.privacy],
          ["/status", L.footer.status],
        ].map(([href, label]) => (
          <a key={href} href={href} className="hover:text-[var(--lp-ink)]">
            {label}
          </a>
        ))}
      </span>
    </footer>
  );
}
