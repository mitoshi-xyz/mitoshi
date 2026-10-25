import { cx } from "@/kit";
import "@/styles/judge.css";

/** 審 ("judge") cut in vermilion: the judges' seal, pressed a little crooked; `press` stamps it in. */
export function Hanko({ size = 56, press = false, className }: { size?: number; press?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("jd-hanko", press && "jd-press", className)}
      style={{ "--size": `${size}px` } as React.CSSProperties}
    >
      審
    </span>
  );
}
