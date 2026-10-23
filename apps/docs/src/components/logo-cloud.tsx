import type { CSSProperties } from "react";

/*
 * The networks and venues Mitoshi works with, as an endless row on one CSS keyframe (no animation library). The marks
 * are the app's own vendored copies, served from this site: nothing is fetched from their owners.
 */

export type Brand = { name: string; logo: string };

export function Logo({ name, className = "size-5" }: { name: string; className?: string }) {
  return (
    <img src={`/marks/${name}.svg`} alt="" aria-hidden className={`inline-block shrink-0 rounded-[6px] ${className}`} />
  );
}

export function LogoCloud({ brands, seconds = 40 }: { brands: Brand[]; seconds?: number }) {
  return (
    <div
      className="not-prose group overflow-hidden py-4 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      aria-label={brands.map((b) => b.name).join(", ")}
      role="img"
    >
      <div
        className="mt-marquee flex w-max group-hover:[animation-play-state:paused]"
        style={{ "--marquee": `${seconds}s` } as CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-10 pe-10" aria-hidden={copy === 1}>
            {brands.map((b) => (
              <span key={b.name} className="flex shrink-0 items-center gap-2.5 text-fd-muted-foreground">
                <Logo name={b.logo} className="size-6" />
                <span className="whitespace-nowrap font-semibold text-[14px]">{b.name}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
