import { HEADLINE, MOTTO, SUBLINE } from "@/lib/constants";
import { Seal } from "./seal";

/** The overview's opening: the motto, the headline and the line under it, word for word as on mitoshi.xyz. */
export function Hero() {
  return (
    <header className="mt-hero flex flex-col gap-4 border-fd-border border-b pb-8">
      <span className="flex items-center gap-2.5 font-mono text-[12px] text-fd-muted-foreground uppercase tracking-[0.14em]">
        <Seal className="size-5" />
        {MOTTO}
      </span>
      <h1 className="font-heading font-semibold text-[2rem] leading-[1.1] tracking-[-0.02em] sm:text-[2.6rem]">
        {HEADLINE}
      </h1>
      <p className="max-w-[60ch] text-[1.05rem] text-fd-muted-foreground leading-relaxed">{SUBLINE}</p>
    </header>
  );
}
