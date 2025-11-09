import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/cn";

import {
  textToneVariants,
  textSizeVariants,
  textVariantDefaults,
  textAlignVariants,
  textAlignDefault,
} from "./textVariants";

const sectionVariants = cva("my-2 leading-relaxed", {
  variants: {
    tone: textToneVariants,
    size: textSizeVariants,
    align: textAlignVariants,
  },
  defaultVariants: {
    tone: textVariantDefaults.tone,
    size: textVariantDefaults.size,
    align: textAlignDefault,
  },
});

type SectionElement = "section" | "article" | "aside" | "nav" | "header" | "footer";

type BaseSectionProps<T extends SectionElement> = Omit<ComponentPropsWithoutRef<T>, "children"> & {
  as?: T;
  children: ReactNode;
};

export type SectionProps<T extends SectionElement = "section"> = BaseSectionProps<T> &
  VariantProps<typeof sectionVariants>;

export function Section<T extends SectionElement = "section">({
  as,
  tone,
  size,
  align,
  className,
  children,
  ...props
}: SectionProps<T>) {
  const Component = (as ?? "section") as SectionElement;

  return (
    <Component className={cn(sectionVariants({ tone, size, align }), className)} {...props}>
      {children}
    </Component>
  );
}
