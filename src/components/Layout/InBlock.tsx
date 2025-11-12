import { type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/cn";

import { createLayoutVariants } from "./commonVariants";

const inBlockVariants = createLayoutVariants("inline-block", {
  defaultVariants: {
    visualEffect: "default",
    space: "none",
  },
});

type InBlockProps = ComponentPropsWithoutRef<"span"> & VariantProps<typeof inBlockVariants>;

export function InBlock({
  visualEffect,
  space,
  padding,
  paddingBlock,
  paddingInline,
  margin,
  marginBlock,
  marginInline,
  className,
  ...props
}: InBlockProps) {
  return (
    <span
      {...props}
      className={cn(
        inBlockVariants({
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
