import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const sectionVariants = createLayoutVariants("block");

type SectionElement = "section" | "article" | "aside" | "nav" | "header" | "footer";

type BaseSectionProps<T extends SectionElement> = Omit<ComponentPropsWithoutRef<T>, "className"> & {
  as?: T;
  className?: string;
};

export type SectionProps<T extends SectionElement = "section"> = BaseSectionProps<T> &
  VariantProps<typeof sectionVariants>;

export function Section<T extends SectionElement = "section">({
  as,
  appearance,
  space,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  ...props
}: SectionProps<T>) {
  const Component = (as ?? "section") as SectionElement;

  return (
    <Component
      {...props}
      className={cn(
        sectionVariants({
          appearance,
          space,
          padding,
          paddingBlock,
          paddingInline,
          margin,
          marginBlock,
          marginInline,
        }),
        className,
      )}
    />
  );
}
