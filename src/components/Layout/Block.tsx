import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { layoutVariants } from "./commonVariants";

const blockVariants = cva("block", {
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

type BlockProps = ComponentPropsWithoutRef<"div"> & VariantProps<typeof blockVariants>;

export function Block({
  visualEffect,
  space,
  padding,
  margin,
  className,
  ...props
}: BlockProps) {
  return (
    <div
      {...props}
      className={cn(blockVariants({ visualEffect, space, padding, margin }), className)}
    />
  );
}
