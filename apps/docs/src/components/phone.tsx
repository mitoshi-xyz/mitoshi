import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import type { ReactNode } from "react";

/*
 * Real screens from mitoshi.xyz. Phone captures (390 × 844) sit in a phone whose status bar holds the island, so the
 * app's own header is never covered; desktop captures (1920 × 1080) sit in a window with the address bar.
 */

const PHONE_RATIO = "aspect-[390/844]";
/** Desktop captures are 1920 × 1080, served at 1600 wide. */
const WIDE = { width: 1600, height: 900 } as const;

export function Phone({
  src,
  alt,
  caption,
  eager = false,
  className = "",
}: {
  src: string;
  alt: string;
  caption?: ReactNode;
  /** Above the fold: load at once instead of when scrolled near. */
  eager?: boolean;
  className?: string;
}) {
  return (
    <figure className={`not-prose m-0 flex flex-col items-center gap-3 ${className}`}>
      <div className="mt-phone relative w-full max-w-[17rem] rounded-[3rem] p-[3.2%]">
        <div className="relative overflow-hidden rounded-[2.65rem] bg-black">
          <div aria-hidden className="flex aspect-[100/11] items-center justify-center bg-[#050505]">
            <span className="h-[50%] w-[30%] rounded-full bg-black ring-1 ring-white/10" />
          </div>
          <img
            src={src}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className={`block w-full object-cover object-top ${PHONE_RATIO}`}
          />
        </div>
      </div>
      {caption ? (
        <figcaption className="max-w-[17rem] text-center text-[13px] text-fd-muted-foreground leading-snug">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Phones side by side; on a phone they scroll sideways instead of shrinking to nothing. */
export function Phones({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose -mx-4 my-8 overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="grid min-w-[36rem] auto-cols-fr grid-flow-col gap-5 sm:min-w-0">{children}</div>
    </div>
  );
}

/** A desktop capture of the app (1920 × 1080), framed like a browser window with mitoshi.xyz in the bar. */
export function Shot({
  src,
  alt,
  caption,
  url = "mitoshi.xyz",
  eager = false,
}: {
  src: string;
  alt: string;
  caption?: ReactNode;
  url?: string;
  eager?: boolean;
}) {
  return (
    <figure className="not-prose my-8">
      <div className="overflow-hidden rounded-[14px] border border-fd-border bg-black shadow-[0_18px_50px_-24px_rgb(0_0_0/0.5)]">
        <div className="flex h-7 items-center gap-1.5 border-white/10 border-b bg-[#111] px-3">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="ms-3 truncate font-mono text-[11px] text-white/50">{url}</span>
        </div>
        <ImageZoom
          src={src}
          alt={alt}
          width={WIDE.width}
          height={WIDE.height}
          priority={eager}
          className="block h-auto w-full"
        />
      </div>
      {caption ? (
        <figcaption className="mt-3 text-center text-[13px] text-fd-muted-foreground">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/** The same screen on desktop and phone: the window on wide columns, the phone on narrow ones. */
export function Screen({
  name,
  alt,
  caption,
  eager = false,
}: {
  /** The capture's slug: /shots/wide/<name>.webp and /shots/phone/<name>.webp. */
  name: string;
  alt: string;
  caption?: ReactNode;
  eager?: boolean;
}) {
  return (
    <div className="mt-screen">
      <div className="mt-screen-wide">
        <Shot src={`/shots/wide/${name}.webp`} alt={alt} caption={caption} eager={eager} />
      </div>
      <div className="mt-screen-phone my-8">
        <Phone src={`/shots/phone/${name}.webp`} alt={alt} caption={caption} eager={eager} />
      </div>
    </div>
  );
}
