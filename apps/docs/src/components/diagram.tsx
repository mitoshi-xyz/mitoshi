import { ImageZoom } from "fumadocs-ui/components/image-zoom";

/*
 * An architecture picture rendered from the README's Mermaid sources (.github/diagrams) in Mitoshi's colours: the
 * light picture in light mode, the dark one in dark, either one opening full size on a tap.
 */

const SIZE = {
  "system-map": { width: 1568, height: 326 },
  "funding-flow": { width: 1568, height: 618 },
} as const;

export function Diagram({ name, alt, caption }: { name: keyof typeof SIZE; alt: string; caption?: string }) {
  const { width, height } = SIZE[name];
  return (
    <figure className="not-prose my-8">
      <div className="overflow-hidden rounded-xl border border-fd-border">
        <ImageZoom
          src={`/diagrams/${name}-light.png`}
          alt={alt}
          width={width}
          height={height}
          className="block w-full dark:hidden"
        />
        <ImageZoom
          src={`/diagrams/${name}-dark.png`}
          alt={alt}
          width={width}
          height={height}
          className="hidden w-full dark:block"
        />
      </div>
      {caption ? <figcaption className="mt-2.5 text-[13px] text-fd-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}
