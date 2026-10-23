import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/** The pages live in content/docs, one MDX file each; meta.json files order the sidebar. */
export const docs = defineDocs({ dir: "content/docs" });

export default defineConfig();
