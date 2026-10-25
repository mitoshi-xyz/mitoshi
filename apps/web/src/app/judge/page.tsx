import type { Metadata } from "next";
import { JudgeGate } from "@/features/judge/gate";

export const metadata: Metadata = {
  title: "Judge desks · Mitoshi 見通し",
  description: "Six funded Mitoshi wallets on Zcash mainnet, one per ZECATHON judge. Trade in 30 seconds.",
  robots: { index: false, follow: false },
};

export default function JudgePage() {
  return <JudgeGate />;
}
