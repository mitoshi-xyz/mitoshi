import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import localFont from "next/font/local";

/**
 * Mitoshi's four faces. next/font self-hosts the Google ones at build time (the browser never asks Google), and
 * Noto Serif JP is a ~2.5 KB subset with only the brand's glyphs (見通し, 隠, 私), SIL OFL 1.1 (src/fonts/…/OFL.txt).
 */
export const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800"],
});
export const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
export const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});
export const notoSerifJp = localFont({
  variable: "--font-noto-serif-jp",
  display: "swap",
  src: [
    { path: "../fonts/noto-serif-jp/500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/noto-serif-jp/700.woff2", weight: "700", style: "normal" },
  ],
});

export const fontVariables = [sora.variable, inter.variable, jetbrains.variable, notoSerifJp.variable].join(" ");
