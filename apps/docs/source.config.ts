import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/**
 * The pages live in content/docs, one MDX file each; meta.json files order the sidebar, and each top folder is a tab.
 * Every page also keeps its processed Markdown, for /llms.txt and the per-page "Copy Markdown".
 */
export const docs = defineDocs({
  dir: "content/docs",
  docs: { schema: pageSchema, postprocess: { includeProcessedMarkdown: true } },
  meta: { schema: metaSchema },
});

export default defineConfig();
