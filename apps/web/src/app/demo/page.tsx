import type { Metadata } from "next";
import { Demo } from "@/features/landing/demo";

export const metadata: Metadata = {
  title: "Demo · Mitoshi 見通し",
  description:
    "Mitoshi in two minutes: predictions, stocks and crypto from shielded ZEC, a new wallet for every trade.",
};

export default function DemoPage() {
  return <Demo />;
}
