import { ArrowRight } from "lucide-react";
import { JUDGE_ORIGIN } from "@/constants";
import { LANDING as L } from "../landing/copy";
import { Hanko } from "./hanko";

/** The landing's first line: where a judge's funded desk is. */
export function JudgeStrip() {
  return (
    <a href={JUDGE_ORIGIN} className="jd-strip">
      <Hanko size={22} />
      <span className="hidden sm:inline">{L.judges.strip}</span>
      <span className="sm:hidden">{L.judges.stripShort}</span>
      <span className="jd-strip-cta">
        {L.judges.stripCta} <ArrowRight size={14} />
      </span>
    </a>
  );
}

/** The judge pass in the hero: a stub in the receipt's language, the 審 seal pressed on its tear-off. */
export function JudgePass() {
  return (
    <a href={JUDGE_ORIGIN} className="jd-pass w-full max-w-[30rem]" aria-label={`${L.judges.title} ${L.judges.cta}`}>
      <span className="jd-pass-body">
        <span className="jd-pass-kicker">{L.judges.kicker}</span>
        <span className="jd-pass-title">{L.judges.title}</span>
        <span className="jd-pass-line">{L.judges.line}</span>
        <span className="mt-1 inline-flex items-center gap-1 font-semibold text-[13px] text-[#b8391a]">
          <span className="sm:hidden">{L.judges.ctaShort}</span>
          <span className="hidden sm:inline">{L.judges.cta}</span>
          <ArrowRight size={14} />
        </span>
      </span>
      <span className="jd-pass-stub">
        <Hanko size={60} />
      </span>
    </a>
  );
}
