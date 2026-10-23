import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG, SITE } from "./site";

/*
 * Link previews in the app's look: the #050505 ground, the vermilion seal, Sora for the title, Inter for the line.
 * Drawn once at build; the fonts are static instances of the site's own faces, read from disk (assets/fonts).
 */

const GROUND = "#050505";
const INK = "#FFFFFF";
const MUTED = "#A3A3A3";
const VERMILION = "#E04D26";
const CREAM = "#F4EEE3";
const LONG_TITLE = 38;
/** The mark fills this share of its disc, as in the app. */
const MARK_SHARE = 0.58;
/** Title size: smaller for a long title, so it never runs into the description. */
const TITLE_SIZE = { long: 62, short: 80 } as const;

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));
const fontsOnce = Promise.all([font("Sora-SemiBold.ttf"), font("Inter-Regular.ttf"), font("JetBrainsMono-Medium.ttf")]);

async function fonts() {
  const [sora, inter, mono] = await fontsOnce;
  return [
    { name: "Sora", data: sora, weight: 600 as const, style: "normal" as const },
    { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
    { name: "JetBrains Mono", data: mono, weight: 500 as const, style: "normal" as const },
  ];
}

/** The Mitoshi mark on its vermilion disc. */
function Seal({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: VERMILION,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * MARK_SHARE} height={size * MARK_SHARE} viewBox="0 0 248 248" fill="none">
        <title>Mitoshi</title>
        <path d="M36 200 H212" stroke="#141210" strokeWidth="28" strokeLinecap="round" />
        <path d="M52 156 C 104 156, 132 92, 182 62" stroke="#141210" strokeWidth="28" strokeLinecap="round" />
        <circle cx="200" cy="44" r="27" fill={CREAM} />
      </svg>
    </div>
  );
}

/** A preview card: a kicker (the section), the title, a line of description. */
export async function ogImage({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description?: string | undefined;
}) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: GROUND,
        backgroundImage: `radial-gradient(circle at 92% 8%, ${VERMILION}33 0%, transparent 38%)`,
        color: INK,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <Seal size={48} />
        <span style={{ fontFamily: "Sora", fontSize: 34, letterSpacing: -0.6 }}>{SITE.name}</span>
        <span style={{ width: 2, height: 30, background: "#2a2a2a", margin: "0 6px" }} />
        <span style={{ fontFamily: "JetBrains Mono", fontSize: 22, color: MUTED, letterSpacing: 1 }}>
          {kicker.toUpperCase()}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 980 }}>
        <span
          style={{
            fontFamily: "Sora",
            fontSize: title.length > LONG_TITLE ? TITLE_SIZE.long : TITLE_SIZE.short,
            lineHeight: 1.04,
            letterSpacing: -2,
          }}
        >
          {title}
        </span>
        {description ? <span style={{ fontSize: 28, lineHeight: 1.35, color: "#C9C9C9" }}>{description}</span> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: MUTED }}>
        <span style={{ fontFamily: "JetBrains Mono" }}>Shielded ZEC · NEAR Intents · a new wallet for every trade</span>
        <span style={{ marginLeft: "auto", fontFamily: "JetBrains Mono" }}>docs.mitoshi.xyz</span>
      </div>
    </div>,
    { ...OG, fonts: await fonts() },
  );
}
