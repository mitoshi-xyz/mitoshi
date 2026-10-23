import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { icons } from "lucide-react";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import { BRANDS } from "@/lib/brands";
import { Diagram } from "./diagram";
import { FundingFlow, Lifecycle, OhttpHops, SystemMap } from "./diagrams";
import { Logo, LogoCloud } from "./logo-cloud";
import { Phone, Phones, Screen, Shot } from "./phone";
import { Receipt, TxId } from "./receipt";
import { Seal } from "./seal";

/** Every network and venue Mitoshi works with, as the endless row. */
function Brands() {
  return <LogoCloud brands={BRANDS} />;
}

/** A lucide icon by name, so .mdx files can write `icon={<Icon name="Shield" />}` without imports. */
function Icon({ name, ...props }: { name: string } & ComponentProps<"svg">) {
  const Glyph = icons[name as keyof typeof icons];
  // A name lucide doesn't have renders nothing rather than breaking the page.
  return Glyph ? <Glyph {...props} /> : null;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    img: (props: ComponentProps<"img">) => <ImageZoom {...(props as ComponentProps<typeof ImageZoom>)} />,
    Accordion,
    Accordions,
    Brands,
    Diagram,
    File,
    Files,
    Folder,
    FundingFlow,
    Icon,
    Lifecycle,
    Logo,
    OhttpHops,
    Phone,
    Phones,
    Receipt,
    Screen,
    Seal,
    Shot,
    Step,
    Steps,
    SystemMap,
    Tab,
    Tabs,
    TxId,
    TypeTable,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;
