import type { Metadata } from "next";
import { DeskConsole } from "@/features/judge/setup/console";

export const metadata: Metadata = { title: "Judge wallets setup · Mitoshi 見通し", robots: { index: false, follow: false } };

export default function DeskSetupPage() {
  return <DeskConsole />;
}
