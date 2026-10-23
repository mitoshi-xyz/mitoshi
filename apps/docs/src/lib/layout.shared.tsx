import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Seal } from "@/components/seal";
import { APP_ORIGIN, REPO_URL } from "./constants";

/** Shared layout options: the seal and name, a link to the app, the source. */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5">
          <Seal />
          <span className="font-heading font-semibold text-[15px] tracking-tight">Mitoshi</span>
          <span className="font-stamp text-[13px] text-fd-muted-foreground" lang="ja">
            見通し
          </span>
          <span className="rounded-full border border-fd-border px-2 py-0.5 font-mono text-[11px] text-fd-muted-foreground">
            docs
          </span>
        </span>
      ),
    },
    links: [
      { text: "Open the app", url: APP_ORIGIN, external: true },
      { text: "Source", url: REPO_URL, external: true },
    ],
  };
}
