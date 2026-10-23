import type { ReactNode } from "react";

/*
 * A real value from the product, shown as a receipt: a kicker, rows of label and figure in the mono face, and where the
 * figure came from. Used for the worked examples (a dry 1Click quote, the NVIDIA order sheet, testnet transactions).
 */

export function Receipt({
  kicker,
  title,
  rows,
  source,
  children,
}: {
  kicker: string;
  title: ReactNode;
  rows: [ReactNode, ReactNode][];
  /** Where the numbers come from, with a date. */
  source: ReactNode;
  children?: ReactNode;
}) {
  return (
    <figure className="not-prose mt-receipt my-8 overflow-hidden rounded-[18px] border border-fd-border bg-fd-card">
      <div className="flex flex-col gap-1 border-fd-border border-b px-5 pt-4 pb-3">
        <span className="font-mono text-[11px] text-fd-muted-foreground uppercase tracking-[0.12em]">{kicker}</span>
        <span className="font-heading font-semibold text-[17px]">{title}</span>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 px-5 py-3">
        {rows.map(([label, value], i) => (
          <div key={i} className="contents">
            <dt className="border-fd-border border-b border-dashed py-2 text-[14px] text-fd-muted-foreground last-of-type:border-0">
              {label}
            </dt>
            <dd className="num border-fd-border border-b border-dashed py-2 text-right text-[14px]">{value}</dd>
          </div>
        ))}
      </dl>
      {children ? <div className="border-fd-border border-t px-5 py-3 text-[14px]">{children}</div> : null}
      <figcaption className="border-fd-border border-t bg-fd-background/40 px-5 py-2.5 text-[12px] text-fd-muted-foreground">
        {source}
      </figcaption>
    </figure>
  );
}

/** A transaction id, shortened on a phone but whole for copying. */
export function TxId({ id }: { id: string }) {
  return (
    <code className="num break-all rounded bg-fd-muted px-1.5 py-0.5 text-[12.5px]" title={id}>
      {id}
    </code>
  );
}
