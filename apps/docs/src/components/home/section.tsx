import type { ReactNode } from "react";

/** A front-page section: a numbered kicker, a title, a line, then its content. */
export function Section({
  n,
  kicker,
  title,
  line,
  children,
}: {
  n: string;
  kicker: string;
  title: ReactNode;
  line?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-[78rem] flex-col gap-8 px-4 py-16 md:px-8 md:py-20">
      <div className="flex max-w-[52rem] flex-col gap-3">
        <span className="font-mono text-[12px] text-fd-muted-foreground uppercase tracking-[0.14em]">
          <span className="text-[var(--mt-accent-text)]">{n}</span> {kicker}
        </span>
        <h2 className="font-heading font-semibold text-[1.9rem] leading-[1.1] tracking-[-0.025em] sm:text-[2.4rem]">
          {title}
        </h2>
        {line ? <p className="max-w-[60ch] text-[1.02rem] text-fd-muted-foreground leading-relaxed">{line}</p> : null}
      </div>
      {children}
    </section>
  );
}
