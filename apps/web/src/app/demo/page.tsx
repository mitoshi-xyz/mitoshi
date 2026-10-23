import type { Metadata } from "next";
import { Demo } from "@/features/landing/demo";

export const metadata: Metadata = {
  title: "Demo · Mitoshi 見通し",
  description: "Mitoshi in two minutes: trade privately from anywhere, from shielded ZEC.",
};

export default function DemoPage() {
  return <Demo />;
}
