import type { Metadata } from "next";
import { DeskFrame } from "@/features/judge/setup/desk-frame";

export const metadata: Metadata = { title: "Judge wallet · Mitoshi 見通し", robots: { index: false, follow: false } };

export default function DeskFramePage() {
  return <DeskFrame />;
}
