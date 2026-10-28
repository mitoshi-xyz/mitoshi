import Link from "next/link";
import { Seal } from "@/components/seal";
import { DOCS, SITE } from "@/lib/site";

/** One phone in the hero's fan, a real capture from mitoshi.xyz. */
function FanPhone({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    <div className={`mt-phone absolute w-[46%] max-w-[15rem] rounded-[2.4rem] p-[2.6%] ${className}`}>
      <div className="overflow-hidden rounded-[2.1rem] bg-black pt-[9%]">
        <img src={src} alt={alt} decoding="async" className="block aspect-[390/844] w-full object-cover object-top" />
      </div>
    </div>
  );
}

/** The front page's opening: the motto, the headline and the line under it, word for word as on mitoshi.xyz. */
export function Hero() {
  return (
    <section className="mt-hero relative overflow-hidden border-fd-border border-b">
      <div className="mx-auto grid max-w-[78rem] gap-12 px-4 pt-14 pb-16 md:grid-cols-[1.05fr_1fr] md:px-8 md:pt-20 md:pb-24">
        <div className="flex flex-col justify-center gap-6">
          <span className="flex items-center gap-2.5 font-mono text-[12px] text-fd-muted-foreground uppercase tracking-[0.14em]">
            <Seal className="size-5" />
            {SITE.motto}
          </span>
          <h1 className="font-heading font-semibold text-[2.4rem] leading-[1.04] tracking-[-0.03em] sm:text-[3.4rem]">
            Trade Polymarket, Hyperliquid and Solana{" "}
            <span className="text-[var(--mt-accent-text)]">privately, from shielded ZEC.</span>
          </h1>
          <p className="max-w-[46ch] text-[1.08rem] text-fd-muted-foreground leading-relaxed">{SITE.subline}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={DOCS.guide}
              className="inline-flex h-11 items-center rounded-full bg-[var(--mt-accent)] px-5 font-semibold text-[#141210] text-[15px] transition-opacity hover:opacity-85"
            >
              Read the guide
            </Link>
            <a
              href={SITE.app}
              className="inline-flex h-11 items-center rounded-full border border-fd-border px-5 font-semibold text-[15px] transition-colors hover:bg-fd-accent"
            >
              Open Mitoshi
            </a>
          </div>
          <p className="font-mono text-[12px] text-fd-muted-foreground">
            Live on Zcash mainnet · no account · your keys stay in your browser
          </p>
        </div>
        <div className="relative mx-auto aspect-[1/0.92] w-full max-w-[34rem]">
          <FanPhone
            src="/shots/phone/event.webp"
            alt="A Polymarket event in Mitoshi with its odds chart."
            className="top-[6%] left-0 -rotate-[7deg]"
          />
          <FanPhone
            src="/shots/phone/order-nvda.webp"
            alt="The Long NVDA order sheet in Mitoshi."
            className="top-[13%] right-0 rotate-[7deg]"
          />
          <FanPhone
            src="/shots/phone/terminal-nvda.webp"
            alt="The NVIDIA perps terminal in Mitoshi with one-hour candles."
            className="top-0 left-1/2 z-10 -translate-x-1/2"
          />
        </div>
      </div>
    </section>
  );
}
