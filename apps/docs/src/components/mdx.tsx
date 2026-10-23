import { Step, Steps } from "fumadocs-ui/components/steps";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { FundingFlow, Lifecycle, OhttpHops, SystemMap } from "./diagrams";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    FundingFlow,
    Lifecycle,
    OhttpHops,
    Step,
    Steps,
    SystemMap,
    ...components,
  };
}
