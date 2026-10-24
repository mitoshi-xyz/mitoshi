import type { Metadata } from "next";
import { PitchDeck } from "@/features/pitch/pitch-deck";

export const metadata: Metadata = {
  title: "Pitch · Mitoshi 見通し",
  description: "Why Mitoshi exists and where it goes next: a new wallet for every trade, funded from shielded ZEC.",
};

export default function PitchPage() {
  return <PitchDeck />;
}
