import { notFound } from "next/navigation";
import { ogImage } from "@/lib/og";
import { getPageImage, source } from "@/lib/source";

export const revalidate = false;

type Context = { params: Promise<{ slug: string[] }> };

/** Each page's link preview (…/image.png), drawn at build time. */
export async function GET(_req: Request, { params }: Context) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();
  const root = page.slugs[0];
  const section = root ? source.getPageTree().children.find((n) => n.type === "folder" && n.$id === root) : undefined;
  return ogImage({
    kicker: typeof section?.name === "string" ? section.name : "Docs",
    title: page.data.title,
    description: page.data.description,
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: getPageImage(page).segments }));
}
