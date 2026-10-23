import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

/** Pages at the site root: docs.mitoshi.xyz/privacy, not /docs/privacy. */
export const source = loader({
  baseUrl: "/",
  source: docs.toFumadocsSource(),
});
