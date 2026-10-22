import type { ReactNode } from "react";
import { cx } from "@/kit";

/** The docs' building blocks: one type scale, so every page reads the same. */

export function Title({ kicker, children }: { kicker?: string; children: ReactNode }) {
  return (
    <header className="flex flex-col gap-2">
      {kicker ? <span className="type-label text-accent">{kicker}</span> : null}
      <h1 className="font-extrabold font-heading text-[36px] leading-[1.08] tracking-[-0.02em] md:text-[44px]">
        {children}
      </h1>
    </header>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="text-[18px] text-ink-2 leading-relaxed">{children}</p>;
}

export function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-6 scroll-mt-24 font-bold font-heading text-[24px] tracking-[-0.01em]">
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 font-semibold text-[17px]">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] text-ink-2 leading-[1.7]">{children}</p>;
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] text-ink-2 leading-[1.65] marker:text-muted">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export function Steps({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((s, i) => (
        <li key={s.title} className="flex gap-4 rounded-xl border border-hairline bg-surface-1 p-4">
          <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-[13px] text-accent-ink">
            {i + 1}
          </span>
          <span className="flex flex-col gap-1">
            <span className="font-medium">{s.title}</span>
            <span className="text-[14px] text-ink-2 leading-relaxed">{s.body}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <table className="w-full min-w-[520px] text-left text-[14px]">
        <thead className="bg-surface-1 text-[12px] text-muted uppercase tracking-[0.06em]">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={cx("px-4 py-3 align-top", j === 0 ? "font-medium text-ink" : "text-ink-2")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <aside
      className={cx(
        "rounded-xl border p-4 text-[14px] leading-relaxed",
        tone === "warn" ? "border-warning/30 bg-warning/10" : "border-hairline bg-surface-1",
      )}
    >
      {children}
    </aside>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[13px] text-ink">{children}</code>;
}
