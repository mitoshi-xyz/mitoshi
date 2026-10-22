"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/kit";
import { Seal } from "../shell/seal";

export const DOC_PAGES = [
  { href: "/docs", title: "Overview" },
  { href: "/docs/how-it-works", title: "How it works" },
  { href: "/docs/privacy", title: "Privacy and threat model" },
  { href: "/docs/venues", title: "Venues" },
  { href: "/docs/fees", title: "Fees and timing" },
  { href: "/docs/recovery", title: "Backup and recovery" },
  { href: "/docs/architecture", title: "Architecture" },
] as const;

/** The docs: a sidebar of pages, one readable column, and next/previous at the foot. */
export function DocsShell({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\/$/, "") || "/docs";
  const i = DOC_PAGES.findIndex((p) => p.href === path);
  const prev = i > 0 ? DOC_PAGES[i - 1] : undefined;
  const next = i >= 0 && i < DOC_PAGES.length - 1 ? DOC_PAGES[i + 1] : undefined;
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="sticky top-0 z-[var(--z-sticky)] border-hairline border-b bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Seal size={28} />
            <span className="font-extrabold font-heading text-[16px] tracking-[0.02em]">MITOSHI</span>
            <span className="text-[14px] text-muted">Docs</span>
          </Link>
          <Link
            href="/markets"
            className="ml-auto inline-flex h-9 items-center rounded-full bg-accent px-4 font-semibold text-[13px] text-accent-ink"
          >
            Open Mitoshi
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Docs" className="md:sticky md:top-24 md:self-start">
          <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] md:flex-col">
            {DOC_PAGES.map((p) => (
              <li key={p.href} className="shrink-0">
                <Link
                  href={p.href}
                  aria-current={p.href === path ? "page" : undefined}
                  className={cx(
                    "block rounded-lg px-3 py-2 text-[14px]",
                    p.href === path ? "bg-surface-1 font-medium text-ink" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="flex min-w-0 max-w-3xl flex-col gap-5">
          {children}
          <div className="mt-10 grid grid-cols-2 gap-3 border-hairline border-t pt-6">
            {prev ? (
              <Link
                href={prev.href}
                className="flex flex-col gap-1 rounded-xl border border-hairline p-4 hover:border-strong"
              >
                <span className="flex items-center gap-1 text-[12px] text-muted">
                  <ArrowLeft size={12} /> Previous
                </span>
                <span className="font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={next.href}
                className="flex flex-col items-end gap-1 rounded-xl border border-hairline p-4 text-right hover:border-strong"
              >
                <span className="flex items-center gap-1 text-[12px] text-muted">
                  Next <ArrowRight size={12} />
                </span>
                <span className="font-medium">{next.title}</span>
              </Link>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
