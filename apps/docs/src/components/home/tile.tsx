import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/*
 * A feature tile on the front page: a real capture of the app, the words above it, and a "Read" line that rises into
 * view on hover. A phone capture peeks up from the bottom in its frame; a desktop capture sits flush like a window.
 */

export function Tile({
  title,
  line,
  href,
  src,
  alt,
  kind,
  tall = false,
  className = "",
}: {
  title: string;
  line: string;
  href: string;
  src: string;
  alt: string;
  kind: "phone" | "wide";
  tall?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[21rem] flex-col overflow-hidden rounded-[22px] border border-fd-border bg-fd-card transition-[border-color,box-shadow] duration-300 hover:border-[var(--mt-strong)] hover:shadow-[0_20px_50px_-30px_rgb(0_0_0/0.5)] ${className}`}
    >
      <div className="relative z-10 flex flex-col gap-1.5 p-6 transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <h3 className="font-heading font-semibold text-[1.25rem] leading-tight tracking-[-0.02em]">{title}</h3>
        <p className="max-w-[36ch] text-[14.5px] text-fd-muted-foreground leading-snug">{line}</p>
        <span className="mt-1 inline-flex translate-y-1 items-center gap-1 font-semibold text-[13px] text-fd-primary opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          Read <ArrowUpRight className="size-3.5" />
        </span>
      </div>
      {kind === "phone" ? (
        <div
          className={`relative mt-auto flex justify-center overflow-hidden px-6 ${tall ? "min-h-[20rem] flex-1" : "h-[14rem]"}`}
        >
          <div
            className={`absolute w-[60%] max-w-[15rem] ${tall ? "bottom-0 translate-y-10" : "top-2 translate-y-4"} rounded-t-[2.2rem] bg-[#1c1c1c] p-[2.6%] pb-0 transition-transform duration-500 ease-out group-hover:translate-y-0`}
          >
            <div className="overflow-hidden rounded-t-[1.9rem] bg-black pt-[8%]">
              <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                className="block aspect-[390/844] w-full object-cover object-top"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mt-auto max-h-[18rem] overflow-hidden ps-6">
          <div className="translate-x-3 translate-y-3 overflow-hidden rounded-tl-[14px] border-fd-border border-t border-l bg-black transition-transform duration-500 ease-out group-hover:translate-x-1 group-hover:translate-y-1">
            <img src={src} alt={alt} loading="lazy" decoding="async" className="block h-auto w-full" />
          </div>
        </div>
      )}
    </Link>
  );
}
