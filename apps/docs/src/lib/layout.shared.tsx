import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared";
import { Seal } from "@/components/seal";
import { DOCS, SITE } from "./site";

/** The one filled action in the bar, vermilion like the app's own buttons. */
const openApp: LinkItemType = {
  type: "custom",
  secondary: true,
  children: (
    <a
      href={SITE.app}
      className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-[var(--mt-accent)] px-3.5 font-semibold text-[#141210] text-[13px] transition-opacity hover:opacity-85"
    >
      Open Mitoshi
    </a>
  ),
};

/** The bar on every page: the seal, the name, 見通し, and the app. */
export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: SITE.repo,
    nav: {
      title: (
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          <Seal />
          <span className="font-heading font-semibold text-[16px] tracking-tight">{SITE.name}</span>
          <span className="font-stamp text-[13px] text-fd-muted-foreground max-sm:hidden" lang="ja">
            見通し
          </span>
          <span className="rounded-full border border-fd-border px-2 py-0.5 font-mono text-[11px] text-fd-muted-foreground max-sm:hidden">
            docs
          </span>
        </span>
      ),
      url: "/",
    },
    links: [openApp],
  };
}

/** The front page's bar also names the docs' sections (inside the docs they are the tabs). */
export function homeOptions(): BaseLayoutProps {
  return {
    ...baseOptions(),
    links: [
      { text: "Guide", url: DOCS.guide, active: "nested-url" },
      { text: "Venues", url: DOCS.venues, active: "nested-url" },
      { text: "Privacy", url: DOCS.privacy, active: "nested-url" },
      { text: "Zcash", url: DOCS.zcash, active: "nested-url" },
      { text: "Build", url: DOCS.build, active: "nested-url" },
      openApp,
    ],
  };
}
