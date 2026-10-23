import Link from "next/link";
import { Seal } from "@/components/seal";

/** The 404 page: served for every unknown path, with its own CSP in a meta tag (scripts/headers.mjs). */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
      <Seal className="size-12" />
      <p className="font-mono text-[13px] text-fd-muted-foreground">404</p>
      <h1 className="font-heading font-semibold text-2xl">Nothing here. Not even a wallet trail.</h1>
      <Link href="/" className="rounded-full bg-[var(--mt-accent)] px-5 py-2.5 font-semibold text-[#141210] text-sm">
        Back to the docs
      </Link>
    </main>
  );
}
