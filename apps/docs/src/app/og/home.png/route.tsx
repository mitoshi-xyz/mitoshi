import { ogImage } from "@/lib/og";
import { SITE } from "@/lib/site";

export const revalidate = false;

/** The front page's link preview. */
export async function GET() {
  return ogImage({ kicker: SITE.motto, title: SITE.headline, description: SITE.subline });
}
