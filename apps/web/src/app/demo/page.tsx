import type { Metadata } from "next";
import { Demo } from "@/features/landing/demo";

export const metadata: Metadata = {
  title: "Demo · Mitoshi 見通し",
  description:
    "Mitoshi in two minutes: Polymarket, Hyperliquid and Solana, privately, from shielded ZEC. A new wallet for every trade.",
};

export default function DemoPage() {
  return <Demo />;
}
