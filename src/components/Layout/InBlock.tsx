import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { layoutVariants } from "./commonVariants";

const inBlockVariants = cva("inline-block", {
  variants: {
    ...layoutVariants,
  },
  defaultVariants: {
    visualEffect: "default",
    space: "none",
    padding: "none",
    margin: "none",
  },
});

type InBlockProps = ComponentPropsWithoutRef<"span"> & VariantProps<typeof inBlockVariants>;

export function InBlock({
  visualEffect,
  space,
  padding,
  margin,
  className,
  ...props
}: InBlockProps) {
  return (
    <span
      {...props}
      className={cn(inBlockVariants({ visualEffect, space, padding, margin }), className)}
    />
  );
}
