import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import localFont from "next/font/local";

/**
 * The app's four faces. next/font downloads the Google ones at build time and serves them from this site, so a reader's
 * browser never asks Google. Noto Serif JP is the app's ~2.5 KB subset with only the brand's glyphs (見通し), SIL OFL 1.1.
 */
const sora = Sora({ variable: "--font-sora", subsets: ["latin"], display: "swap", weight: ["600", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});
const notoSerifJp = localFont({
  variable: "--font-noto-serif-jp",
  display: "swap",
  src: [{ path: "../fonts/noto-serif-jp/500.woff2", weight: "500", style: "normal" }],
});

export const fontVariables = [sora.variable, inter.variable, jetbrains.variable, notoSerifJp.variable].join(" ");
