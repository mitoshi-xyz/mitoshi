import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";
import { Seal } from "@/components/seal";
import { homeOptions } from "@/lib/layout.shared";
import { DOCS } from "@/lib/site";

/** A missing page (exported as 404.html, served for any path the site doesn't have), with its own meta CSP. */
export default function NotFound() {
  return (
    <HomeLayout {...homeOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
        <Seal className="size-14" />
        <p className="font-mono text-[13px] text-fd-muted-foreground">404</p>
        <h1 className="font-heading font-semibold text-3xl tracking-[-0.02em]">
          Nothing here. Not even a wallet trail.
        </h1>
        <p className="max-w-sm text-fd-muted-foreground">
          This page moved or never existed. The docs start at the guide.
        </p>
        <Link
          href={DOCS.guide}
          className="inline-flex h-11 items-center rounded-full bg-[var(--mt-accent)] px-5 font-semibold text-[#141210] text-[14px]"
        >
          Go to the guide
        </Link>
      </main>
    </HomeLayout>
  );
}
