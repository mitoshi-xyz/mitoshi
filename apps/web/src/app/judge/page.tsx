import type { Metadata } from "next";
import { JudgeGate } from "@/features/judge/gate";

export const metadata: Metadata = {
  title: "Judge wallet · Mitoshi 見通し",
  description: "A Mitoshi wallet with real money on Zcash mainnet for the ZECATHON judges. Trade in 30 seconds.",
  robots: { index: false, follow: false },
};

export default function JudgePage() {
  return <JudgeGate />;
}
