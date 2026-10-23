import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import type { ReactNode } from "react";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

/** The docs: a top bar with the sections as tabs (Guide, Venues, Privacy, Zcash, Build), a sidebar below. */
export default function Layout({ children }: { children: ReactNode }) {
  const { nav, ...base } = baseOptions();
  return (
    <DocsLayout tree={source.getPageTree()} tabMode="navbar" nav={{ ...nav, mode: "top" }} {...base}>
      {children}
    </DocsLayout>
  );
}
