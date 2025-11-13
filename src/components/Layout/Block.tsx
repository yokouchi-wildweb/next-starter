import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const blockVariants = createLayoutVariants("block");

type BlockProps = ComponentPropsWithoutRef<"div"> & VariantProps<typeof blockVariants>;

export function Block({
  visualEffect,
  space = "md",
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  ...props
}: BlockProps) {
  return (
    <div
      {...props}
      className={cn(
        blockVariants({
          visualEffect,
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
