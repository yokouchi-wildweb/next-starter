import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { layoutVariants } from "./commonVariants";

const sectionVariants = cva("block", {
  variants: {
    ...layoutVariants,
  },
  defaultVariants: {
    visualEffect: "default",
    space: "md",
    padding: "none",
    margin: "none",
  },
});

type SectionElement = "section" | "article" | "aside" | "nav" | "header" | "footer";

type BaseSectionProps<T extends SectionElement> = Omit<ComponentPropsWithoutRef<T>, "className"> & {
  as?: T;
  className?: string;
};

export type SectionProps<T extends SectionElement = "section"> = BaseSectionProps<T> &
  VariantProps<typeof sectionVariants>;

export function Section<T extends SectionElement = "section">({
  as,
  visualEffect,
  space,
  padding,
  margin,
  className,
  ...props
}: SectionProps<T>) {
  const Component = (as ?? "section") as SectionElement;

  return (
    <Component
      {...props}
      className={cn(sectionVariants({ visualEffect, space, padding, margin }), className)}
    />
  );
}
